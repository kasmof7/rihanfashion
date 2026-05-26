document.addEventListener('DOMContentLoaded', function() {
    const loader = document.querySelector('.loader');
    const body = document.body;

    function hideLoader() {
        body.style.overflow = '';
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(function() {
                if (loader) loader.style.display = 'none';
            }, 400);
        }
    }

    body.style.overflow = 'hidden';
    window.scrollTo({ top: 0, behavior: 'auto' });

    // Preload hero background image, keep loader until it loads
    const heroImg = new Image();
    let heroLoaded = false;
    let pageLoaded = false;

    heroImg.onload = function() { heroLoaded = true; checkReady(); };
    heroImg.onerror = function() { heroLoaded = true; checkReady(); };
    heroImg.src = 'images/hero-bg.jpg';

    window.addEventListener('load', function() {
        pageLoaded = true;
        checkReady();
    });

    // Fallback: hide after 10 seconds no matter what
    const fallbackTimer = setTimeout(hideLoader, 10000);

    function checkReady() {
        if (heroLoaded && pageLoaded) {
            clearTimeout(fallbackTimer);
            hideLoader();
        }
    }
    
    const headerBrandText = document.querySelector('.header-brand-text');
    if (headerBrandText) {
        headerBrandText.addEventListener('click', function() {
            this.style.color = '#c9a87c';
            this.style.textShadow = '0 0 10px #c9a87c, 0 0 20px #c9a87c, 0 0 30px #c9a87c';
            setTimeout(function() {
                headerBrandText.style.color = '#FFEAD4';
                headerBrandText.style.textShadow = 'none';
            }, 1500);
        });
    }

    window.toggleMobileMenu = function() {
        const mobileMenu = document.querySelector('.mobile-menu');
        const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
        const body = document.body;
        
        if (mobileMenu && mobileMenuOverlay) {
            mobileMenu.classList.toggle('active');
            mobileMenuOverlay.classList.toggle('active');
            
            if (mobileMenu.classList.contains('active')) {
                body.classList.add('menu-open');
            } else {
                body.classList.remove('menu-open');
            }
        }
    };

    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const textarea = this.querySelector('textarea');
            
            if (textarea && textarea.value.trim()) {
                const reviewText = textarea.value.trim();
                
                // Store locally as backup
                const reviews = JSON.parse(localStorage.getItem('rf_reviews') || '[]');
                reviews.push({
                    name: 'زائر',
                    review: reviewText,
                    date: new Date().toISOString()
                });
                localStorage.setItem('rf_reviews', JSON.stringify(reviews));
                
                // Send to API
                try {
                    await fetch('/api/reviews', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: 'زائر', review: reviewText })
                    });
                } catch (err) {
                    console.warn('Failed to send review to server, stored locally');
                }
                
                document.getElementById('reviewPopup').classList.add('show');
                textarea.value = '';
            }
        });
    }

    window.closeReviewPopup = function() {
        document.getElementById('reviewPopup').classList.remove('show');
    };

    document.addEventListener('click', function(e) {
        const modal = document.getElementById('bookingModal');
        if (modal && e.target === modal) {
            window.closeBookingModal();
        }
    });

    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(function() {
                const header = document.querySelector('.main-header');
                if (window.scrollY > 100) {
                    header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
                } else {
                    header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                }
                ticking = false;
            });
            ticking = true;
        }
    });

    loadHomeDresses();
});

async function loadHomeDresses() {
    const track = document.getElementById('homeDressesGrid');
    if (!track) return;

    let dresses;
    try {
        const res = await fetch('/api/dresses?limit=5');
        if (res.ok) {
            const data = await res.json();
            dresses = data.dresses || data;
        }
    } catch (e) {}

    if (!dresses || !dresses.length) {
        dresses = await loadSampleDresses();
    }

    renderHomeDresses(track, dresses.slice(0, 5));
    initCarousel(track);
}

function renderHomeDresses(track, dresses) {
    const imgBase = 'https://placehold.co/600x800';

    // XSS protection
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    track.innerHTML = dresses.map(d => {
        const imgSrc = d.images?.[0] || `${imgBase}/391925/FFEAD4?text=فستان`;
        const hasDiscount = d.discountPrice && d.discountPrice < d.price;
        const displayPrice = hasDiscount ? d.discountPrice : d.price;
        const isOutOfStock = d.inStock === false;
        const name = escapeHtml(d.name);
        const desc = escapeHtml(d.description || '');

        return `
            <div class="carousel-card">
                <div class="carousel-card-image">
                    <img src="${imgSrc}" alt="${name}" loading="lazy" />
                    ${d.isNew ? '<span class="dress-badge new">جديد</span>' : ''}
                    ${d.isOnSale ? '<span class="dress-badge sale">تخفيض</span>' : ''}
                    ${isOutOfStock ? '<span class="dress-badge out">نفذت</span>' : ''}
                </div>
                <div class="carousel-card-info">
                    <h3>${name}</h3>
                    <p>${desc}</p>
                    <div class="carousel-card-price">
                        ${hasDiscount ? `<span class="original-price">${d.price} رس</span>` : ''}
                        <span class="current-price">${displayPrice ? displayPrice + ' رس' : 'السعر يحدد بعد الاستشارة'}</span>
                    </div>
                    <div class="carousel-card-actions">
                        <button class="btn-primary home-book-btn" data-id="${d._id}">احجز الآن</button>
                        <a href="dresses/dresses.html" class="btn-secondary">المزيد</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    track.querySelectorAll('.home-book-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = document.getElementById('bookingModal');
            if (modal) {
                document.getElementById('bookingDressId').value = this.dataset.id;
                modal.classList.add('show');
                modal.style.display = 'flex';
            }
        });
    });
}

function initCarousel(track) {
    let isDown = false, startX = 0, scrollLeft = 0;
    let autoScroll;
    let currentIndex = 0;
    let animFrameId = null;

    function getCardWidth() {
        return track.children[0]?.offsetWidth || 0;
    }

    function getCardsPerView() {
        const w = getCardWidth();
        return w > 0 ? Math.round(track.clientWidth / w) : 1;
    }

    function cancelAnimation() {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }

    function animateScroll(targetLeft, duration = 400) {
        cancelAnimation();
        const start = track.scrollLeft;
        const distance = targetLeft - start;
        if (Math.abs(distance) < 1) return;
        const startTime = performance.now();
        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            track.scrollLeft = start + distance * ease;
            if (progress < 1) animFrameId = requestAnimationFrame(step);
        }
        animFrameId = requestAnimationFrame(step);
    }

    function scrollToIndex(index) {
        const card = track.children[index];
        if (!card) return;
        animateScroll(card.offsetLeft);
    }

    function startAutoScroll() {
        stopAutoScroll();
        autoScroll = setInterval(() => {
            const total = track.children.length;
            const perView = getCardsPerView();
            const maxIndex = total - perView;
            if (currentIndex >= maxIndex) {
                currentIndex = 0;
                animateScroll(0);
            } else {
                currentIndex++;
                scrollToIndex(currentIndex);
            }
        }, 4000);
    }

    function stopAutoScroll() {
        clearInterval(autoScroll);
    }

    function updateCurrentIndex() {
        const cardW = getCardWidth();
        if (cardW > 0) {
            currentIndex = Math.round(track.scrollLeft / cardW);
        }
    }

    track.addEventListener('mousedown', e => {
        isDown = true;
        cancelAnimation();
        track.classList.add('dragging');
        startX = e.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
        stopAutoScroll();
    });

    track.addEventListener('mouseleave', () => {
        isDown = false;
        track.classList.remove('dragging');
        updateActiveDot();
        startAutoScroll();
    });

    track.addEventListener('mouseup', () => {
        isDown = false;
        track.classList.remove('dragging');
        updateActiveDot();
        startAutoScroll();
    });

    track.addEventListener('mousemove', e => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - track.offsetLeft;
        const walk = (x - startX) * 1.5;
        track.scrollLeft = scrollLeft - walk;
    });

    track.addEventListener('touchstart', () => {
        cancelAnimation();
        stopAutoScroll();
    }, { passive: true });

    track.addEventListener('touchend', () => {
        updateActiveDot();
        setTimeout(startAutoScroll, 2000);
    }, { passive: true });

    const nextBtn = document.querySelector('.carousel-arrow-next');
    const prevBtn = document.querySelector('.carousel-arrow-prev');

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            cancelAnimation();
            stopAutoScroll();
            const total = track.children.length;
            const perView = getCardsPerView();
            if (currentIndex < total - perView) {
                currentIndex++;
                scrollToIndex(currentIndex);
            }
            setTimeout(startAutoScroll, 3000);
        });
    }
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            cancelAnimation();
            stopAutoScroll();
            if (currentIndex > 0) {
                currentIndex--;
                scrollToIndex(currentIndex);
            }
            setTimeout(startAutoScroll, 3000);
        });
    }

    function initDots() {
        const dotsContainer = document.getElementById('carouselDots');
        if (!dotsContainer) return;
        const total = track.children.length;
        const perView = getCardsPerView();
        const dotCount = Math.max(total - perView + 1, 1);
        dotsContainer.innerHTML = Array.from({ length: dotCount }, (_, i) =>
            `<span class="carousel-dot" data-index="${i}"></span>`
        ).join('');
        dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const idx = parseInt(dot.dataset.index);
                cancelAnimation();
                stopAutoScroll();
                currentIndex = idx;
                scrollToIndex(currentIndex);
                setTimeout(startAutoScroll, 3000);
            });
        });
    }

    function updateActiveDot() {
        const dotsContainer = document.getElementById('carouselDots');
        if (!dotsContainer) return;
        updateCurrentIndex();
        dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentIndex);
        });
    }

    initDots();
    updateActiveDot();
    track.addEventListener('scroll', updateActiveDot);
    startAutoScroll();
}
