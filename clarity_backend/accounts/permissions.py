# accounts/permissions.py
from rest_framework.permissions import BasePermission

class IsAgent(BasePermission):
    def has_permission(self, request, view):
        return request.user.groups.filter(name="AGENT").exists()

class IsUser(BasePermission):
    def has_permission(self, request, view):
        return request.user.groups.filter(name="USER").exists()
