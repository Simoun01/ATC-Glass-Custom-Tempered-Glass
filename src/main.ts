import { initHeroCausticBackground } from './causticBackground';
import { initGlassAnatomy3D } from './glassAnatomy3d';
import { initHeroGlass3D } from './heroGlass3d';
import { initMotionEffects } from './motionEffects';

function bootstrapExperience() {
  initHeroCausticBackground();
  initHeroGlass3D();
  initGlassAnatomy3D();
  initMotionEffects();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapExperience);
} else {
  bootstrapExperience();
}
