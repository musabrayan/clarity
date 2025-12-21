from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.profile.role
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = User.objects.get(username=attrs['username'])
        data['role'] = user.profile.role
        data['username'] = user.username
        data['token'] = data.get('access')
        return data
