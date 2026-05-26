// Shared booking modal utility
(function() {
  'use strict';

  const WHATSAPP_NUMBER = '+963939735881';

  window.openBookingModal = function(dressId) {
    const modal = document.getElementById('bookingModal');
    if (modal) {
      const dressIdInput = document.getElementById('bookingDressId');
      if (dressIdInput) dressIdInput.value = dressId || '';
      modal.classList.add('show');
      modal.style.display = 'flex';
    }
  };

  window.closeBookingModal = function() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
    }
  };

  function initBookingForm(formId) {
    const form = document.getElementById(formId || 'bookingForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get('name') || '';
      const phone = data.get('phone') || '';
      const eventDate = data.get('eventDate') || '';
      const notes = data.get('notes') || '';
      const dressId = data.get('dressId') || '';

      const text = `*طلب استشارة مجانية - Rihan Fashion*%0A%0A👤 الاسم: ${encodeURIComponent(name)}%0A📱 واتساب: ${encodeURIComponent(phone)}%0A📅 تاريخ المناسبة: ${encodeURIComponent(eventDate)}%0A📝 ملاحظات: ${encodeURIComponent(notes)}%0A🆔 معرف الفستان: ${encodeURIComponent(dressId)}`;

      window.closeBookingModal();
      window.open('https://api.whatsapp.com/send?phone=' + WHATSAPP_NUMBER + '&text=' + text, '_blank');

      // Show thank you if review popup exists
      const reviewPopup = document.getElementById('reviewPopup');
      if (reviewPopup) reviewPopup.classList.add('show');

      form.reset();
    });
  }

  // Close modal when clicking outside
  document.addEventListener('click', function(e) {
    const modal = document.getElementById('bookingModal');
    if (modal && e.target === modal) {
      window.closeBookingModal();
    }
  });

  // Initialize all booking forms on the page
  document.addEventListener('DOMContentLoaded', function() {
    initBookingForm('bookingForm');

    // Attach book-btn click handlers dynamically
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('book-btn') || e.target.closest('.book-btn')) {
        const btn = e.target.classList.contains('book-btn') ? e.target : e.target.closest('.book-btn');
        if (btn && btn.dataset.id) {
          e.preventDefault();
          window.openBookingModal(btn.dataset.id);
        }
      }
    });
  });
})();
