function openParticipantsPopup(eventId, sessionId) {
    const url = `/events/${eventId}/sessions/${sessionId}/participants`;
  
    // Create a modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  
    // Create a modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <iframe src="${url}" frameborder="0" width="100%" height="100%"></iframe>
        <button onclick="closeParticipantsPopup()">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  
    // Prevent scrolling on the background page
    document.body.style.overflow = 'hidden';
  
    // Function to close the modal dialog
    window.closeParticipantsPopup = function() {
      document.body.removeChild(overlay);
      document.body.removeChild(modal);
      document.body.style.overflow = ''; // Restore scrolling on the background page
      delete window.closeParticipantsPopup;
    };
  }
  