const burger = document.querySelector('.header__burger');
const mobileMenu = document.querySelector('.mobile-menu');
const overlay = document.querySelector('.mobile-menu-overlay');
const menuLinks = document.querySelectorAll('.mobile-menu a');
const body = document.body;

// mobile menu

function closeMenu() {
  burger?.classList.remove('active');
  mobileMenu?.classList.remove('active');
  overlay?.classList.remove('active');
  body.classList.remove('menu-open');
}

function toggleMenu() {
  burger?.classList.toggle('active');
  mobileMenu?.classList.toggle('active');
  overlay?.classList.toggle('active');
  body.classList.toggle('menu-open');
}

burger?.addEventListener('click', toggleMenu);
overlay?.addEventListener('click', closeMenu);

menuLinks.forEach((link) => {
  link.addEventListener('click', closeMenu);
});

// header scroll

const header = document.querySelector('.header');

let lastScroll = 0;

window.addEventListener(
  'scroll',
  () => {
    // если меню открыто — header не трогаем
    if (body.classList.contains('menu-open')) return;

    const currentScroll = window.pageYOffset;

    // фон при скролле
    if (currentScroll > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }

    // скрытие вниз / показ вверх
    if (currentScroll > lastScroll && currentScroll > 120) {
      header?.classList.add('hidden');
    } else {
      header?.classList.remove('hidden');
    }

    lastScroll = currentScroll <= 0 ? 0 : currentScroll;
  },
  { passive: true },
);

// swiper

if (typeof Swiper !== 'undefined') {
  new Swiper('.reviews-swiper', {
    loop: true,
    spaceBetween: 20,

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

      768: {
        slidesPerView: 2,
      },

      1200: {
        slidesPerView: 3,
      },
    },
  });
}
