document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [
            // Sample events - in a real app, load from server
            {
                title: 'Team Meeting',
                start: '2025-12-05T10:00:00',
                end: '2025-12-05T11:00:00',
                backgroundColor: '#667eea',
                borderColor: '#667eea'
            },
            {
                title: 'Client Presentation',
                start: '2025-12-10T14:00:00',
                end: '2025-12-10T15:30:00',
                backgroundColor: '#764ba2',
                borderColor: '#764ba2'
            }
        ],
        dateClick: function(info) {
            openEventModal(info.dateStr);
        },
        eventClick: function(info) {
            if (confirm('Delete this event?')) {
                info.event.remove();
                saveEvents();
            }
        },
        editable: true,
        eventDrop: function(info) {
            saveEvents();
        },
        eventResize: function(info) {
            saveEvents();
        }
    });
    calendar.render();

    // Event Modal Functions
    function openEventModal(dateStr) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Schedule New Event</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="eventForm">
                        <div style="margin-bottom: 1rem;">
                            <label for="eventTitle" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Event Title</label>
                            <input type="text" id="eventTitle" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 1rem;">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="eventDate" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Date</label>
                            <input type="date" id="eventDate" value="${dateStr}" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 1rem;">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="eventStart" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Start Time</label>
                            <input type="time" id="eventStart" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 1rem;">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="eventEnd" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">End Time</label>
                            <input type="time" id="eventEnd" required style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 1rem;">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label for="eventDescription" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Description (Optional)</label>
                            <textarea id="eventDescription" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 1rem; resize: vertical;"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn-danger" id="saveEventBtn">Save Event</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add event listener for save button
        document.getElementById('saveEventBtn').addEventListener('click', function() {
            const title = document.getElementById('eventTitle').value;
            const date = document.getElementById('eventDate').value;
            const startTime = document.getElementById('eventStart').value;
            const endTime = document.getElementById('eventEnd').value;
            const description = document.getElementById('eventDescription').value;

            if (title && date && startTime && endTime) {
                const start = `${date}T${startTime}:00`;
                const end = `${date}T${endTime}:00`;

                calendar.addEvent({
                    title: title,
                    start: start,
                    end: end,
                    description: description,
                    backgroundColor: '#667eea',
                    borderColor: '#667eea'
                });

                saveEvents();
                modal.remove();
            } else {
                alert('Please fill in all required fields.');
            }
        });
    }

    // Save events to localStorage (in a real app, save to server)
    function saveEvents() {
        const events = calendar.getEvents().map(event => ({
            title: event.title,
            start: event.start.toISOString(),
            end: event.end ? event.end.toISOString() : null,
            backgroundColor: event.backgroundColor,
            borderColor: event.borderColor,
            description: event.extendedProps.description
        }));
        localStorage.setItem('calendarEvents', JSON.stringify(events));
    }

    // Load events from localStorage
    function loadEvents() {
        const savedEvents = localStorage.getItem('calendarEvents');
        if (savedEvents) {
            const events = JSON.parse(savedEvents);
            events.forEach(event => {
                calendar.addEvent(event);
            });
        }
    }

    // Load events on init
    loadEvents();
    // Add this to your schedule.js or in a script tag
document.addEventListener('DOMContentLoaded', function() {
    // Create floating particles
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-container';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
    `;
    document.body.appendChild(particleContainer);
    
    // Create particles
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random properties
        const size = Math.random() * 3 + 1;
        const xStart = Math.random() * 100;
        const xEnd = xStart + (Math.random() * 40 - 20);
        const duration = Math.random() * 10 + 10;
        const delay = Math.random() * 20;
        
        particle.style.cssText = `
            --x-start: ${xStart}vw;
            --x-end: ${xEnd}vw;
            width: ${size}px;
            height: ${size}px;
            background: ${i % 3 === 0 ? 'var(--neon-purple)' : 
                         i % 3 === 1 ? 'var(--neon-cyan)' : 
                         'var(--neon-pink)'};
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
        `;
        
        particleContainer.appendChild(particle);
    }
});
});