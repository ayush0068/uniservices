// public/js/admin.js

// Status select handlers
document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async function() {
        const contactId = this.dataset.id;
        const newStatus = this.value;
        
        try {
            const response = await fetch(`/admin-contact/${contactId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update the status badge in contact detail page if it exists
                const statusBadge = document.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.className = `status-badge status-${newStatus}`;
                    statusBadge.textContent = newStatus;
                }
                
                showNotification('Status updated successfully', 'success');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error updating status', 'error');
        }
    });
});

// Delete contact handlers
document.querySelectorAll('.delete-contact').forEach(button => {
    button.addEventListener('click', async function() {
        if (!confirm('Are you sure you want to delete this contact?')) {
            return;
        }
        
        const contactId = this.dataset.id;
        
        try {
            const response = await fetch(`/admin-contact/${contactId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Remove row from table
                const row = this.closest('tr');
                row.remove();
                showNotification('Contact deleted successfully', 'success');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error deleting contact', 'error');
        }
    });
});

// Notes saving in contact detail page
const notesTextarea = document.getElementById('notes');
const saveNotesBtn = document.getElementById('save-notes');

if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', async function() {
        const contactId = this.dataset.id;
        const notes = notesTextarea.value;
        
        try {
            const response = await fetch(`/admin-contact/${contactId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notes })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Notes saved successfully', 'success');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error saving notes', 'error');
        }
    });
}

// Plan management
const planForm = document.getElementById('plan-form');
if (planForm) {
    planForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);
        
        // Handle features array
        if (data.features) {
            data.features = data.features.split(',').map(f => f.trim());
        }
        
        const method = this.dataset.method || 'POST';
        const url = this.dataset.url || '/admin/plans';
        
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Plan saved successfully', 'success');
                setTimeout(() => {
                    window.location.href = '/admin/plans';
                }, 1500);
            } else {
                showNotification('Error saving plan', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error saving plan', 'error');
        }
    });
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        min-width: 300px;
        background: white;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 9999;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px;
    }
    
    .notification-success {
        border-left: 4px solid #28a745;
    }
    
    .notification-error {
        border-left: 4px solid #dc3545;
    }
    
    .notification-info {
        border-left: 4px solid #17a2b8;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
    }
    
    .notification-close:hover {
        color: #666;
    }
`;

document.head.appendChild(style);