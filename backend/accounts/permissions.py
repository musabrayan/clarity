from rest_framework.permissions import BasePermission


class IsAgent(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.profile.role == 'AGENT'
        )


class IsNormalUser(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.profile.role == 'USER'
        )
