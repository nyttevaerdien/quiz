import json
import os
from flask import Flask, render_template, jsonify, request, redirect, url_for, session, flash
from datetime import datetime
import requests
import threading
import time
from database import db
from rabbitmq_producer import rabbitmq_producer

app = Flask(__name__)
app.secret_key = 'quiz_bot_admin_secret_key_2024'  # Change this in production

# Initialize RabbitMQ producer connection at startup
def initialize_rabbitmq():
    """Initialize RabbitMQ producer connection"""
    try:
        rabbitmq_producer._connect()
        print("RabbitMQ producer initialized successfully")
    except Exception as e:
        print(f"Failed to initialize RabbitMQ producer: {e}")
        print("Note: Producer will auto-connect when sending messages")

# Try to initialize on module load (RabbitMQ might not be ready yet, but that's OK)
# The producer will auto-connect when needed thanks to _ensure_connected()
try:
    initialize_rabbitmq()
except Exception as e:
    print(f"Could not initialize RabbitMQ at startup: {e}")
    print("Will auto-connect when sending first message")

def broadcast_to_telegram(message, broadcast_type='broadcast'):
    """Broadcast message to all registered users via RabbitMQ"""
    try:
        # Ensure connection is established (will auto-connect if needed)
        if not rabbitmq_producer._ensure_connected():
            print(f"⚠️ Warning: RabbitMQ producer not connected, but will attempt to send anyway")
        
        # Send message to RabbitMQ
        success = rabbitmq_producer.send_message(message, broadcast_type)
        if success:
            print(f"✅ Broadcast sent to RabbitMQ: {message}")
        else:
            print(f"❌ Failed to send broadcast to RabbitMQ: {message}")
            print(f"   This might indicate a connection issue. Check RabbitMQ logs.")
    except Exception as e:
        print(f"❌ Error sending broadcast to RabbitMQ: {e}")
        import traceback
        traceback.print_exc()

def broadcast_to_all_users(message):
    """Broadcast message to ALL registered users (not just game participants)"""
    try:
        # Ensure connection is established (will auto-connect if needed)
        if not rabbitmq_producer._ensure_connected():
            print(f"⚠️ Warning: RabbitMQ producer not connected, but will attempt to send anyway")
        
        # Send message to RabbitMQ with special type for all users
        success = rabbitmq_producer.send_message(message, 'broadcast_all_users')
        if success:
            print(f"✅ Broadcast to all users sent to RabbitMQ: {message}")
        else:
            print(f"❌ Failed to send broadcast to all users to RabbitMQ: {message}")
            print(f"   This might indicate a connection issue. Check RabbitMQ logs.")
    except Exception as e:
        print(f"❌ Error sending broadcast to all users to RabbitMQ: {e}")
        import traceback
        traceback.print_exc()

def backup_game_results():
    """Backup current game results to a timestamped file"""
    try:
        # Use database backup function
        backup_filename = db.create_backup()
        return backup_filename
    except Exception as e:
        print(f"Error creating backup: {e}")
        return None

def calculate_leaderboard():
    """Calculate leaderboard scores"""
    return db.calculate_leaderboard()

# Admin authentication
def login_required(f):
    """Decorator to require admin login"""
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login page"""
    if request.method == 'POST':
        password = request.form.get('password')
        if password == 'admin':  # Simple password check
            session['admin_logged_in'] = True
            flash('Successfully logged in as admin!', 'success')
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Invalid password!', 'error')
    return render_template('admin_login.html')

@app.route('/admin/logout')
def admin_logout():
    """Admin logout"""
    session.pop('admin_logged_in', None)
    flash('Logged out successfully!', 'info')
    return redirect(url_for('admin_login'))

@app.route('/admin')
@login_required
def admin_panel():
    """Redirect to dashboard"""
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/start_game', methods=['POST'])
@login_required
def admin_start_game():
    """Start a new game"""
    # Always backup existing results before starting new game
    backup_filename = backup_game_results()
    
    # Always start fresh - clear all data
    db.start_game()
    db.clear_answers()
    db.clear_correct_answers()
    db.clear_game_participants()  # Clear previous game participants
    
    # Broadcast to ALL registered users (not just participants, since there are none yet)
    broadcast_to_all_users("🎮 Game started! Use /join_game to participate.")
    
    if backup_filename:
        flash(f'Game started! Previous results backed up to {backup_filename}', 'success')
    else:
        flash('Game started!', 'success')
    
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/end_game', methods=['POST'])
@login_required
def admin_end_game():
    """End current game"""
    game_state = db.get_game_state()
    
    if not game_state['is_active']:
        flash('No game is currently active!', 'error')
        return redirect(url_for('admin_panel'))
    
    # End the game
    db.end_game()
    
    # Broadcast to current game participants about game end (before clearing them)
    broadcast_to_telegram("🏁 Game ended! Thank you for participating.")
    
    # Clear game participants after sending the notification
    db.clear_game_participants()
    
    flash('Game ended successfully!', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/next_question', methods=['POST'])
@login_required
def admin_next_question():
    """Move to next question"""
    game_state = db.get_game_state()
    
    if not game_state['is_active']:
        flash('No game is currently active!', 'error')
        return redirect(url_for('admin_panel'))
    
    # Move to next question
    db.next_question()
    
    # Get updated game state
    updated_state = db.get_game_state()
    
    # Broadcast to players
    broadcast_to_telegram(f"📝 Now answering to question {updated_state['current_question']}")
    
    flash(f'Question {updated_state["current_question"]} is now active!', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/start_grading', methods=['POST'])
@login_required
def admin_start_grading():
    """Start grading phase"""
    game_state = db.get_game_state()
    
    if not game_state['is_active']:
        flash('No game is currently active!', 'error')
        return redirect(url_for('admin_panel'))
    
    # Start grading phase
    db.start_grading_phase()
    
    # Broadcast to players
    broadcast_to_telegram("📊 Grading phase started! Answers are now being reviewed.")
    
    flash('Grading phase started! You can now review and grade answers.', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/')
def index():
    """Redirect to admin login"""
    return redirect(url_for('admin_login'))

@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    """Main admin dashboard with tabs"""
    game_state = db.get_game_state()
    users = db.get_game_participants()  # Only show joined players
    answers = db.get_all_answers()
    correct_answers = db.get_correct_answers()
    leaderboard = calculate_leaderboard()
    
    # Get all unique questions
    questions = sorted([q for q in answers.keys() if q.startswith('question_')], 
                      key=lambda x: int(x.split('_')[1]))
    
    # Create table data for answers
    table_data = []
    for user_id, player in users.items():
        row = {'player': player, 'user_id': user_id}
        for question in questions:
            question_num = question.split('_')[1]
            # Find answer for this player in this question
            player_answer = None
            for answer_user_id, answer_data in answers[question].items():
                if answer_data.get('nickname') == player:
                    player_answer = answer_data.get('answer', '')
                    break
            
            # Check if this answer is marked as correct
            correct_key = f"{user_id}_{question_num}"
            is_correct = correct_key in correct_answers and correct_answers[correct_key]
            
            row[f'q{question_num}'] = {
                'answer': player_answer or '',
                'is_correct': is_correct,
                'correct_key': correct_key
            }
        table_data.append(row)
    
    # Count registered players
    player_count = len(users)
    
    # Count questions
    question_count = len(questions)
    
    # Get all users for the users tab
    all_users = db.get_all_users()
    game_participants = db.get_game_participants()
    
    # Add participation status to users
    user_data = []
    for user_id, nickname in all_users.items():
        user_data.append({
            'user_id': user_id,
            'nickname': nickname,
            'is_participant': user_id in game_participants
        })
    
    return render_template('admin_dashboard.html', 
                         table_data=table_data, 
                         questions=questions,
                         game_state=game_state,
                         leaderboard=leaderboard,
                         player_count=player_count,
                         question_count=question_count,
                         users=user_data)

@app.route('/admin/users')
@login_required
def admin_users():
    """User management page"""
    users = db.get_all_users()
    game_participants = db.get_game_participants()
    
    # Add participation status to users
    user_data = []
    for user_id, nickname in users.items():
        user_data.append({
            'user_id': user_id,
            'nickname': nickname,
            'is_participant': user_id in game_participants
        })
    
    return render_template('admin_users.html', users=user_data)

@app.route('/admin/remove_user/<user_id>', methods=['POST'])
@login_required
def admin_remove_user(user_id):
    """Remove a user"""
    if db.remove_user(user_id):
        flash(f'User {user_id} has been removed successfully!', 'success')
    else:
        flash(f'Failed to remove user {user_id}', 'error')
    
    return redirect(url_for('admin_dashboard'))

@app.route('/api/answers')
def api_answers():
    """API endpoint to get answers data"""
    users = db.get_game_participants()  # Only show joined players
    answers = db.get_all_answers()
    game_state = db.get_game_state()
    
    return jsonify({
        'users': users,
        'answers': answers,
        'game_state': game_state
    })

@app.route('/api/toggle_correct', methods=['POST'])
def api_toggle_correct():
    """API endpoint to toggle correct answer status"""
    data = request.get_json()
    correct_key = data.get('correct_key')
    
    if not correct_key:
        return jsonify({'error': 'Missing correct_key'}), 400
    
    # Parse user_id and question_number from correct_key
    try:
        user_id, question_number = correct_key.split('_')
        question_number = int(question_number)
        
        if db.toggle_correct_answer(user_id, question_number):
            return jsonify({
                'success': True,
                'is_correct': True,  # We'll get the actual status from the database
                'leaderboard': calculate_leaderboard()
            })
        else:
            return jsonify({'error': 'Failed to toggle correct answer'}), 500
            
    except ValueError:
        return jsonify({'error': 'Invalid correct_key format'}), 400

@app.route('/api/health')
def api_health():
    """Health check endpoint for Docker"""
    return jsonify({'status': 'healthy', 'service': 'quiz-webapp'})

@app.route('/api/refresh')
def api_refresh():
    """API endpoint to refresh data"""
    users = db.get_game_participants()  # Only show joined players
    answers = db.get_all_answers()
    game_state = db.get_game_state()
    correct_answers = db.get_correct_answers()
    leaderboard = calculate_leaderboard()
    
    # Get all unique questions
    questions = sorted([q for q in answers.keys() if q.startswith('question_')], 
                      key=lambda x: int(x.split('_')[1]))
    
    # Create table data
    table_data = []
    for user_id, player in users.items():
        row = {'player': player, 'user_id': user_id}
        for question in questions:
            question_num = question.split('_')[1]
            # Find answer for this player in this question
            player_answer = None
            for answer_user_id, answer_data in answers[question].items():
                if answer_data.get('nickname') == player:
                    player_answer = answer_data.get('answer', '')
                    break
            
            # Check if this answer is marked as correct
            correct_key = f"{user_id}_{question_num}"
            is_correct = correct_key in correct_answers and correct_answers[correct_key]
            
            row[f'q{question_num}'] = {
                'answer': player_answer or '',
                'is_correct': is_correct,
                'correct_key': correct_key
            }
        table_data.append(row)
    
    # Get all users for the users tab
    all_users = db.get_all_users()
    
    return jsonify({
        'table_data': table_data,
        'questions': questions,
        'game_state': game_state,
        'leaderboard': leaderboard,
        'users': all_users
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
