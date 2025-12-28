"""
Test all API endpoints
Run with: python manage.py test test_endpoints
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status


class EndpointTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        self.user = User.objects.create_user(**self.user_data)

    def test_register_endpoint(self):
        """Test user registration"""
        response = self.client.post('/api/auth/register/', {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'newpass123',
            'password2': 'newpass123',
            'role': 'USER'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_login_endpoint(self):
        """Test user login"""
        response = self.client.post('/api/auth/login/', self.user_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_logout_endpoint(self):
        """Test user logout"""
        # First login to get token
        login_response = self.client.post('/api/auth/login/', self.user_data)
        refresh_token = login_response.data['refresh']
        
        # Test logout
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )
        response = self.client.post('/api/auth/logout/', {
            'refresh': refresh_token
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_token_refresh_endpoint(self):
        """Test token refresh"""
        # First login
        login_response = self.client.post('/api/auth/login/', self.user_data)
        refresh_token = login_response.data['refresh']
        
        # Refresh token
        response = self.client.post('/api/auth/token/refresh/', {
            'refresh': refresh_token
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_agent_voice_token_endpoint(self):
        """Test agent voice token endpoint"""
        # Login first
        login_response = self.client.post('/api/auth/login/', self.user_data)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )
        
        # Test voice token
        response = self.client.get('/voice/agent/token/')
        # Will fail if user is not an agent (expected)
        self.assertIn(response.status_code, [200, 403])

    def test_user_voice_token_endpoint(self):
        """Test user voice token endpoint"""
        # Login first
        login_response = self.client.post('/api/auth/login/', self.user_data)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )
        
        # Test voice token
        response = self.client.get('/voice/user/token/')
        # Will fail if user is not a regular user (expected)
        self.assertIn(response.status_code, [200, 403])

    def test_agent_only_view(self):
        """Test agent-only endpoint"""
        login_response = self.client.post('/api/auth/login/', self.user_data)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )
        
        response = self.client.get('/api/auth/agent/')
        # Will fail if user is not an agent (expected)
        self.assertIn(response.status_code, [200, 403])
