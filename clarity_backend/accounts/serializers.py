from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile
from rest_framework_simplejwt.tokens import RefreshToken


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration with role selection."""
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, write_only=True)
    user_id = serializers.SerializerMethodField()
    access = serializers.SerializerMethodField()
    refresh = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'role', 'user_id', 'access', 'refresh']

    def validate(self, data):
        """Validate password match."""
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password2": "Passwords do not match"})
        return data

    def create(self, validated_data):
        """Create user with role and generate JWT tokens."""
        role = validated_data.pop('role')
        validated_data.pop('password2')  # Remove password2 before creating user

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )

        user.profile.role = role
        user.profile.save()

        return user
    
    def get_user_id(self, obj):
        """Return user ID."""
        return obj.id
    
    def get_access(self, obj):
        """Generate access token."""
        refresh = RefreshToken.for_user(obj)
        return str(refresh.access_token)
    
    def get_refresh(self, obj):
        """Generate refresh token."""
        refresh = RefreshToken.for_user(obj)
        return str(refresh)
    
    def to_representation(self, instance):
        """Add role to response."""
        data = super().to_representation(instance)
        data['role'] = instance.profile.role
        return data
