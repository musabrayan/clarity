from django.urls import path
from .views import RegisterView, LogoutView, LoginView, AgentOnlyView, AgentAvailabilityView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('agent/', AgentOnlyView.as_view()),
    path('availability/', AgentAvailabilityView.as_view()),
]
