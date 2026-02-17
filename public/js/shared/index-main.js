// ==================== INDEX PARTICLES ANIMATION ====================

document.addEventListener('DOMContentLoaded', () => {
  // Crear partículas
  const particlesContainer = document.getElementById('particles');
  
  if (particlesContainer) {
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 15 + 's';
      particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
      particlesContainer.appendChild(particle);
    }
  }
  
  console.log('✅ Index main initialized');
});
