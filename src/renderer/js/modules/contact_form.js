/**
 * İletişim Formu Modülü
 * Form doğrulama ve gönderme işlevlerini yönetir
 */
const ContactFormModule = (function() {
    // Private değişkenler
    const formSelector = '#contactForm';
    
    // Form alanlarını doğrular
    function validateForm(form) {
        let isValid = true;
        const name = form.querySelector('#name');
        const email = form.querySelector('#email');
        const subject = form.querySelector('#subject');
        const message = form.querySelector('#message');
        
        // Ad alanı doğrulama
        if (!name.value.trim()) {
            showError(name, 'Lütfen adınızı ve soyadınızı giriniz');
            isValid = false;
        } else {
            removeError(name);
        }
        
        // E-posta doğrulama
        if (!email.value.trim()) {
            showError(email, 'Lütfen e-posta adresinizi giriniz');
            isValid = false;
        } else if (!isValidEmail(email.value)) {
            showError(email, 'Lütfen geçerli bir e-posta adresi giriniz');
            isValid = false;
        } else {
            removeError(email);
        }
        
        // Konu doğrulama
        if (!subject.value.trim()) {
            showError(subject, 'Lütfen bir konu giriniz');
            isValid = false;
        } else {
            removeError(subject);
        }
        
        // Mesaj doğrulama
        if (!message.value.trim()) {
            showError(message, 'Lütfen mesajınızı giriniz');
            isValid = false;
        } else {
            removeError(message);
        }
        
        return isValid;
    }
    
    // Hata mesajı gösterir
    function showError(input, message) {
        const formGroup = input.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message') || document.createElement('div');
        
        if (!formGroup.querySelector('.error-message')) {
            errorElement.className = 'error-message';
            formGroup.appendChild(errorElement);
            input.classList.add('input-error');
        }
        
        errorElement.textContent = message;
    }
    
    // Hata mesajını kaldırır
    function removeError(input) {
        const formGroup = input.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message');
        
        if (errorElement) {
            formGroup.removeChild(errorElement);
            input.classList.remove('input-error');
        }
    }
    
    // E-posta formatını doğrular
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Form gönderim olayını yakalar
    function handleFormSubmit(e) {
        const form = e.target;
        
        if (!validateForm(form)) {
            e.preventDefault(); // Form geçerli değilse gönderimi engelle
        }
    }
    
    // Public API
    return {
        init: function() {
            const form = document.querySelector(formSelector);
            
            if (form) {
                form.addEventListener('submit', handleFormSubmit);
                
                // Input alanları için anında geri bildirim
                form.querySelectorAll('input, textarea').forEach(input => {
                    input.addEventListener('blur', function() {
                        if (this.value.trim()) {
                            removeError(this);
                            
                            // E-posta özel kontrolü
                            if (this.id === 'email' && !isValidEmail(this.value)) {
                                showError(this, 'Lütfen geçerli bir e-posta adresi giriniz');
                            }
                        }
                    });
                });
                
                console.log('İletişim formu başlatıldı');
            }
        }
    };
})();

// Modülü dışa aktar
window.ContactFormModule = ContactFormModule;