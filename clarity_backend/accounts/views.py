from rest_framework.views import APIView
from rest_framework.response import Response
from .serializers import RegisterSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

class RegisterView(APIView):
    permission_classes = []  # Allow public access

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "success": True,
                "message": "User registered successfully",
                "data": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email
                }
            }, status=201)
        return Response({
            "success": False,
            "error": serializer.errors
        }, status=400)

class LoginView(APIView):
    permission_classes = []  # Allow public access

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({
                "success": False,
                "error": "Username and password are required"
            }, status=400)

        user = authenticate(username=username, password=password)

        if user is not None:
            refresh = RefreshToken.for_user(user)
            role = user.groups.first().name if user.groups.exists() else None

            return Response({
                "success": True,
                "message": "Login successful",
                "data": {
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": role
                    },
                    "tokens": {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token)
                    }
                }
            }, status=200)
        else:
            return Response({
                "success": False,
                "error": "Invalid credentials"
            }, status=401)

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = user.groups.first().name if user.groups.exists() else None

        return Response({
            "success": True,
            "data": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": role
            }
        })

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({
                    "success": False,
                    "error": "Refresh token is required"
                }, status=400)
            
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({
                "success": True,
                "message": "Logged out successfully"
            }, status=200)
        except Exception as e:
            return Response({
                "success": False,
                "error": "Invalid token"
            }, status=400)