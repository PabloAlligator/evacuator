const burger = document.querySelector('.header__burger');
const mobileMenu = document.querySelector('.mobile-menu');
const overlay = document.querySelector('.mobile-menu-overlay');
const menuLinks = document.querySelectorAll('.mobile-menu a');

function toggleMenu() {
  burger.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  overlay.classList.toggle('active');
  document.body.classList.toggle('menu-open');
}

burger?.addEventListener('click', toggleMenu);
overlay?.addEventListener('click', toggleMenu);

menuLinks.forEach((link) => {
  link.addEventListener('click', () => {
    burger.classList.remove('active');
    mobileMenu.classList.remove('active');
    overlay.classList.remove('active');
    document.body.classList.remove('menu-open');
  });
});

// swiper
// swiper
if (typeof Swiper !== 'undefined') {
  const reviewsSwiper = new Swiper('.reviews-swiper', {
    loop: true,
    spaceBetween: 18,

    autoplay: {
      delay: 4000,
      disableOnInteraction: false,
    },

    pagination: {
      el: '.reviews-swiper__pagination',
      clickable: true,
    },

    navigation: {
      nextEl: '.reviews-swiper__next',
      prevEl: '.reviews-swiper__prev',
    },

    breakpoints: {
      0: {
        slidesPerView: 1,
      },

      760: {
        slidesPerView: 2,
      },

      1180: {
        slidesPerView: 3,
      },
    },
  });
}
