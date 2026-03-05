from flask import Blueprint
from controllers.issue_controller import (
    create_issue,
    get_user_issues,
    get_all_issues,
    get_issue,
    update_issue_status,
)
from middleware.is_authenticated import is_authenticated

issue_bp = Blueprint('issues', __name__)


# Customer: create a bug/issue report
@issue_bp.route('/', methods=['POST'])
@is_authenticated
def create():
    return create_issue()


# Customer: get their own issues
@issue_bp.route('/user/<user_id>', methods=['GET'])
@is_authenticated
def user_issues(user_id):
    return get_user_issues(user_id)


# Agent: get all reported issues
@issue_bp.route('/', methods=['GET'])
@is_authenticated
def all_issues():
    return get_all_issues()


# Get single issue detail
@issue_bp.route('/<issue_id>', methods=['GET'])
@is_authenticated
def single_issue(issue_id):
    return get_issue(issue_id)


# Agent: update issue status
@issue_bp.route('/<issue_id>/status', methods=['PATCH'])
@is_authenticated
def update_status(issue_id):
    return update_issue_status(issue_id)
