from flask import Blueprint, request, jsonify, make_response
from controllers.user_controller import register, login, logout
from middleware.is_authenticated import is_authenticated

user_bp = Blueprint('user', __name__)

@user_bp.route('/register', methods=['POST'])
def user_register():
    return register()

@user_bp.route('/login', methods=['POST'])
def user_login():
    return login()

@user_bp.route('/logout', methods=['GET'])
@is_authenticated
def user_logout():
    return logout()