const burger = document.querySelector(".header__burger");
const mobileMenu = document.querySelector(".mobile-menu");
const overlay = document.querySelector(".mobile-menu-overlay");
const menuLinks = document.querySelectorAll(".mobile-menu a");

function toggleMenu() {
  burger.classList.toggle("active");
  mobileMenu.classList.toggle("active");
  overlay.classList.toggle("active");
  document.body.classList.toggle("menu-open");
}

burger?.addEventListener("click", toggleMenu);
overlay?.addEventListener("click", toggleMenu);

menuLinks.forEach((link) => {
  link.addEventListener("click", () => {
    burger.classList.remove("active");
    mobileMenu.classList.remove("active");
    overlay.classList.remove("active");
    document.body.classList.remove("menu-open");
  });
});
