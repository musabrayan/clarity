from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone_number = db.Column(db.String, unique=True)
    first_seen = db.Column(db.DateTime, default=datetime.utcnow)

class Call(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'))
    audio_path = db.Column(db.String)
    transcript = db.Column(db.Text)
    emotion_label = db.Column(db.String)
    emotion_score = db.Column(db.Float)
    summary = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)