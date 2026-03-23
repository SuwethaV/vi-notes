from flask import Flask, request, jsonify
from sklearn.ensemble import IsolationForest
import numpy as np
import re
import math
import torch
import torch.nn as nn
import torch.optim as optim

app = Flask(__name__)

# ---------------------------------------------------------
# 1. PyTorch Supervised Model (Human vs AI Classification)
# ---------------------------------------------------------
# Class 1: Human (Broader distribution, more variance in punctuation and math)
human_features = np.column_stack((
    np.random.normal(0.65, 0.15, 1000),   # vocab diversity
    np.random.normal(25.0, 15.0, 1000),   # variance
    np.random.normal(4.8, 0.8, 1000),     # avg word len
    np.random.uniform(3.5, 4.5, 1000),    # shannon entropy
    np.random.normal(0.01, 0.05, 1000)    # paste ratio (very low)
))
human_labels = np.ones((1000, 1)) * 0.95  # Soft labels for accuracy smoothing

# Class 0: AI/Pasted (Tighter distributions, slightly higher entropy, zero variance)
ai_features = np.column_stack((
    np.random.normal(0.50, 0.08, 1000),
    np.random.normal(8.0, 4.0, 1000),
    np.random.normal(5.8, 0.4, 1000),
    np.random.uniform(4.2, 5.0, 1000),
    np.random.normal(0.6, 0.3, 1000)      # often pasted
))
ai_labels = np.zeros((1000, 1)) * 0.05

X_train = torch.FloatTensor(np.vstack((human_features, ai_features)))
y_train = torch.FloatTensor(np.vstack((human_labels, ai_labels)))

class TextAuthenticityNet(nn.Module):
    def __init__(self):
        super(TextAuthenticityNet, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(5, 32), # Added entropy
            nn.Dropout(0.2),  # Prevents rigid 100% or 0% outputs
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid() 
        )

    def forward(self, x):
        return self.network(x)

supervised_model = TextAuthenticityNet()
criterion = nn.BCELoss()
optimizer = optim.Adam(supervised_model.parameters(), lr=0.005)

for epoch in range(120): # Train longer for fine-tuned accuracy
    optimizer.zero_grad()
    predictions = supervised_model(X_train)
    loss = criterion(predictions, y_train)
    loss.backward()
    optimizer.step()

# Scikit-Learn Unsupervised Anomaly Detection
anomaly_detector = IsolationForest(contamination=0.05, random_state=42)
anomaly_detector.fit(human_features[:, :4])

def calculate_shannon_entropy(text):
    if not text: return 0.0
    prob = [float(text.count(c)) / len(text) for c in dict.fromkeys(list(text))]
    return -sum([p * math.log(p) / math.log(2.0) for p in prob])

def analyze_text_statistics(text):
    if not text or len(text.strip()) == 0:
        return {"words": 0, "avg_word_length": 0, "sentence_length_variance": 0, "vocab_diversity": 0, "entropy": 0}
        
    words = re.findall(r'\b\w+\b', text.lower())
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 0]
    
    num_words = len(words)
    unique_words = len(set(words))
    
    vocab_diversity = unique_words / num_words if num_words > 0 else 0
    sentence_lengths = [len(s.split()) for s in sentences]
    avg_sentence_len = sum(sentence_lengths) / len(sentence_lengths) if sentences else 0
    
    variance = sum((l - avg_sentence_len) ** 2 for l in sentence_lengths) / len(sentence_lengths) if len(sentence_lengths) > 1 else max(10, avg_sentence_len * 0.5)
    avg_word_length = sum(len(w) for w in words) / num_words if num_words > 0 else 0
    
    entropy = calculate_shannon_entropy(text)

    return {
        "num_words": num_words,
        "avg_word_length": avg_word_length,
        "sentence_length_variance": variance,
        "vocab_diversity": vocab_diversity,
        "entropy": entropy
    }

@app.route('/predict', methods=['POST'])
def predict_authenticity():
    data = request.json
    content = data.get('content', '')
    total_paste_length = data.get('totalPasteLength', 0)
    
    features = analyze_text_statistics(content)
    paste_ratio = total_paste_length / len(content) if len(content) > 0 else 0
    
    if features['num_words'] < 15:
        base = 88 if paste_ratio < 0.2 else 35
        return jsonify({
            "authenticity_score": base - int(paste_ratio * 30),
            "prediction_class": "Short Text Evaluated",
            "model_confidence": 0.4,
            "statistical_signatures": features,
            "details": f"Processed {features['num_words']} words. Mathematical proxy applied."
        })

    input_tensor = torch.FloatTensor([[
        features['vocab_diversity'], 
        features['sentence_length_variance'],
        features['avg_word_length'],
        features['entropy'],
        paste_ratio
    ]])
    
    with torch.no_grad():
        supervised_prob = supervised_model(input_tensor).item() 
        
    anomaly_score_raw = anomaly_detector.decision_function([[
        features['vocab_diversity'], 
        features['sentence_length_variance'],
        features['avg_word_length'],
        features['entropy']
    ]])[0]
    
    # Mathematical scalar output smoothing
    anomaly_multiplier = max(0.5, min(1.0, (anomaly_score_raw + 0.3) / 0.5))

    # Exact neural score tracking
    score = (supervised_prob * 100) * anomaly_multiplier
    score = max(5, min(99, score))
    
    prediction_class = "Likely Human"
    if score < 40:
        prediction_class = "AI Generated / Heavily Pasted (Supervised)"
    elif score < 70:
        prediction_class = "AI Assisted / Mixed"

    return jsonify({
        "authenticity_score": int(score),
        "prediction_class": prediction_class,
        "model_confidence": round(abs(score - 50) / 50.0, 2),
        "statistical_signatures": features,
        "details": f"PyTorch Supervised Probability: {round(supervised_prob*100, 1)}%. NLP Variance Anomaly: {round(anomaly_multiplier, 2)}x"
    })

if __name__ == '__main__':
    app.run(port=8000, debug=True)
