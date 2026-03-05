from flask import request, jsonify
from models.issue_model import issue_model, VALID_STATUSES, VALID_PRIORITIES, VALID_CATEGORIES
from models.user_model import user_model
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)


def _serialize_issue(issue):
    """Convert ObjectId fields to strings for JSON serialization"""
    if not issue:
        return None
    issue['_id'] = str(issue['_id'])
    issue['userId'] = str(issue['userId']) if issue.get('userId') else None
    issue['assignedAgentId'] = str(issue['assignedAgentId']) if issue.get('assignedAgentId') else None
    if issue.get('createdAt'):
        issue['createdAt'] = issue['createdAt'].isoformat()
    if issue.get('updatedAt'):
        issue['updatedAt'] = issue['updatedAt'].isoformat()
    return issue


def _enrich_issues_with_names(issues):
    """Resolve userId/assignedAgentId to customerName/agentName via batch lookup"""
    all_ids = set()
    for issue in issues:
        uid = issue.get('userId')
        aid = issue.get('assignedAgentId')
        if uid:
            all_ids.add(str(uid))
        if aid:
            all_ids.add(str(aid))

    user_map = user_model.find_by_ids(list(all_ids)) if all_ids else {}

    for issue in issues:
        _serialize_issue(issue)

        uid = issue.get('userId')
        if uid:
            user_doc = user_map.get(uid)
            issue['customerName'] = user_doc.get('fullName', 'Unknown') if user_doc else 'Unknown'
        else:
            issue['customerName'] = 'Unknown'

        aid = issue.get('assignedAgentId')
        if aid:
            agent_doc = user_map.get(aid)
            issue['agentName'] = agent_doc.get('fullName', 'Unassigned') if agent_doc else 'Unassigned'
        else:
            issue['agentName'] = 'Unassigned'

    return issues


def create_issue():
    """Create a new issue/bug report (customer)"""
    try:
        user_id = request.user_id
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'Request body is required'}), 400

        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        category = data.get('category', 'Bug')
        priority = data.get('priority', 'Medium')

        if not title:
            return jsonify({'success': False, 'message': 'Title is required'}), 400

        if category not in VALID_CATEGORIES:
            return jsonify({'success': False, 'message': f'Invalid category. Must be one of: {", ".join(VALID_CATEGORIES)}'}), 400

        if priority not in VALID_PRIORITIES:
            return jsonify({'success': False, 'message': f'Invalid priority. Must be one of: {", ".join(VALID_PRIORITIES)}'}), 400

        issue_id = issue_model.create_issue({
            'userId': user_id,
            'title': title,
            'description': description,
            'category': category,
            'priority': priority,
        })

        return jsonify({
            'success': True,
            'message': 'Issue reported successfully',
            'issueId': str(issue_id),
        }), 201

    except Exception as e:
        logger.error(f"Error creating issue: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to create issue'}), 500


def get_user_issues(user_id):
    """Get all issues submitted by a specific user"""
    try:
        issues = issue_model.find_by_user(user_id)
        enriched = _enrich_issues_with_names(issues)

        return jsonify({
            'success': True,
            'issues': enriched,
        }), 200

    except Exception as e:
        logger.error(f"Error fetching user issues: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to load issues'}), 500


def get_all_issues():
    """Get all issues (agent view) with optional status/priority filters"""
    try:
        filters = {}
        status_filter = request.args.get('status')
        priority_filter = request.args.get('priority')

        if status_filter and status_filter in VALID_STATUSES:
            filters['status'] = status_filter
        if priority_filter and priority_filter in VALID_PRIORITIES:
            filters['priority'] = priority_filter

        issues = issue_model.find_all(filters if filters else None)
        enriched = _enrich_issues_with_names(issues)

        return jsonify({
            'success': True,
            'issues': enriched,
        }), 200

    except Exception as e:
        logger.error(f"Error fetching all issues: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to load issues'}), 500


def get_issue(issue_id):
    """Get a single issue by ID"""
    try:
        issue = issue_model.find_by_id(issue_id)
        if not issue:
            return jsonify({'success': False, 'message': 'Issue not found'}), 404

        enriched = _enrich_issues_with_names([issue])

        return jsonify({
            'success': True,
            'issue': enriched[0],
        }), 200

    except Exception as e:
        logger.error(f"Error fetching issue: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to load issue'}), 500


def update_issue_status(issue_id):
    """Update the status of an issue (agent)"""
    try:
        user_id = request.user_id
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'Request body is required'}), 400

        status = data.get('status', '').strip()
        if status not in VALID_STATUSES:
            return jsonify({
                'success': False,
                'message': f'Invalid status. Must be one of: {", ".join(VALID_STATUSES)}'
            }), 400

        updated = issue_model.update_status(issue_id, status, agent_id=user_id)

        if not updated:
            return jsonify({'success': False, 'message': 'Issue not found or no change'}), 404

        return jsonify({
            'success': True,
            'message': 'Issue status updated successfully',
        }), 200

    except Exception as e:
        logger.error(f"Error updating issue status: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to update issue status'}), 500
