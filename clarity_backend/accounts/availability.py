"""
Agent Availability Management

Handles agent online/offline status for chat assignment.
"""

from django.core.cache import cache
from django.contrib.auth.models import User
from datetime import datetime, timedelta


class AgentAvailability:
    """Service for managing agent availability status."""
    
    CACHE_TIMEOUT = 3600  # 1 hour
    AVAILABILITY_KEY_PREFIX = "agent_availability:"
    AVAILABLE_AGENTS_KEY = "available_agents_list"
    
    @staticmethod
    def set_availability(user, is_available):
        """
        Set agent availability status.
        
        Args:
            user: User object
            is_available: Boolean
        """
        key = f"{AgentAvailability.AVAILABILITY_KEY_PREFIX}{user.id}"
        
        if is_available:
            cache.set(key, {
                'user_id': user.id,
                'username': user.username,
                'timestamp': datetime.now().isoformat()
            }, AgentAvailability.CACHE_TIMEOUT)
            
            # Add to available agents set
            available_agents = cache.get(AgentAvailability.AVAILABLE_AGENTS_KEY, set())
            available_agents.add(user.id)
            cache.set(AgentAvailability.AVAILABLE_AGENTS_KEY, available_agents, AgentAvailability.CACHE_TIMEOUT)
        else:
            cache.delete(key)
            
            # Remove from available agents set
            available_agents = cache.get(AgentAvailability.AVAILABLE_AGENTS_KEY, set())
            available_agents.discard(user.id)
            cache.set(AgentAvailability.AVAILABLE_AGENTS_KEY, available_agents, AgentAvailability.CACHE_TIMEOUT)
    
    @staticmethod
    def is_available(user):
        """Check if agent is available."""
        key = f"{AgentAvailability.AVAILABILITY_KEY_PREFIX}{user.id}"
        return cache.get(key) is not None
    
    @staticmethod
    def get_available_agents():
        """Get list of available agents."""
        from .models import Profile
        
        available_agent_ids = cache.get(AgentAvailability.AVAILABLE_AGENTS_KEY, set())
        
        if not available_agent_ids:
            return []
        
        # Get agent users
        agents = User.objects.filter(
            id__in=available_agent_ids,
            profile__role='AGENT'
        ).select_related('profile')
        
        return [{
            'id': agent.id,
            'username': agent.username,
            'first_name': agent.first_name,
            'last_name': agent.last_name
        } for agent in agents]
    
    @staticmethod
    def has_available_agents():
        """Check if any agents are available."""
        available_agent_ids = cache.get(AgentAvailability.AVAILABLE_AGENTS_KEY, set())
        return len(available_agent_ids) > 0
