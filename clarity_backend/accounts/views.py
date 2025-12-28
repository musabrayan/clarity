from rest_framework import generics, permissions
from django.contrib.auth.models import User
from .serializers import RegisterSerializer
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from .token import CustomTokenObtainPairSerializer
from rest_framework.views import APIView
from rest_framework import status
from .permissions import IsAgent
from .availability import AgentAvailability


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer


class LogoutView(generics.GenericAPIView):
    """Logout endpoint - blacklists refresh token."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out successfully"})
        except Exception as e:
            return Response(
                {"error": "Invalid or expired token"}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class LoginView(TokenObtainPairView):
    """Login endpoint with custom JWT claims."""
    serializer_class = CustomTokenObtainPairSerializer


class AgentOnlyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAgent]

    def get(self, request):
        return Response({
            "message": "Hello Agent",
            "agent": request.user.username
        })


class AgentAvailabilityView(APIView):
    """
    Agent availability management endpoint.
    
    GET: Check agent availability status
    POST: Set agent availability (agents only)
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get current agent availability status."""
        # Check if user is agent
        try:
            is_agent = request.user.profile.role == 'AGENT'
        except:
            is_agent = False
        
        if is_agent:
            # Return agent's own status
            is_available = AgentAvailability.is_available(request.user)
            return Response({
                'is_agent': True,
                'is_available': is_available
            })
        else:
            # Return general availability for users
            has_available_agents = AgentAvailability.has_available_agents()
            available_agents = AgentAvailability.get_available_agents()
            return Response({
                'is_agent': False,
                'has_available_agents': has_available_agents,
                'available_count': len(available_agents)
            })
    
    def post(self, request):
        """Set agent availability (agents only)."""
        # Check if user is agent
        try:
            if request.user.profile.role != 'AGENT':
                return Response(
                    {'error': 'Only agents can set availability'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except:
            return Response(
                {'error': 'User profile not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_available = request.data.get('is_available', False)
        
        AgentAvailability.set_availability(request.user, is_available)
        
        return Response({
            'message': 'Availability updated successfully',
            'is_available': is_available
        })

