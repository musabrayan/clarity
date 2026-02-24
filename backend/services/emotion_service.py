from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=1
)

def detect_emotion(text):
    result = classifier(text)[0][0]
    return result["label"], result["score"]