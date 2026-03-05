from flask import Blueprint, request, jsonify, make_response
from controllers.user_controller import register, login, logout, get_user_public_info
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

@user_bp.route('/<user_id>/info', methods=['GET'])
@is_authenticated
def user_public_info(user_id):
    return get_user_public_info(user_id)