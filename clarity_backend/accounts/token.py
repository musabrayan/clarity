from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer with additional user claims."""

    @classmethod
    def get_token(cls, user):
        """Add custom claims to JWT token."""
        token = super().get_token(user)
        token['role'] = user.profile.role
        token['username'] = user.username
        token['user_id'] = user.id
        return token

    def validate(self, attrs):
        """Add user info to response payload."""
        data = super().validate(attrs)
        user = User.objects.get(username=attrs['username'])
        data['role'] = user.profile.role
        data['username'] = user.username
        data['user_id'] = user.id
        return data
