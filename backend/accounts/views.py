from rest_framework import generics, permissions
from django.contrib.auth.models import User
from .serializers import RegisterSerializer
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from .token import CustomTokenObtainPairSerializer
from rest_framework.views import APIView
from .permissions import IsAgent


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class LogoutView(generics.GenericAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out successfully"})
        except Exception:
            return Response({"error": "Invalid token"}, status=400)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class AgentOnlyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAgent]

    def get(self, request):
        return Response({
            "message": "Hello Agent",
            "agent": request.user.username
        })
