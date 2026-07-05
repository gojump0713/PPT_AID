// config.js — deck-level configuration (sections, transitions, branding)
window.DECK_CONFIG = {
  title: 'AI Native Campus',
  storageKey: 'ppt_aid_last_slide',
  design: { width: 1920, height: 1080 },

  // Section map (1-based slide numbers, inclusive ranges).
  // Derived from the source deck's chapter structure.
  sections: [
    { name: 'Opening',            from: 1,  to: 1,  color: '#00ab89' },
    { name: 'Background · Problem', from: 2,  to: 4,  color: '#4f7cff' },
    { name: 'Solution Overview',  from: 5,  to: 8,  color: '#7c5cff' },
    { name: 'Dstation · Estation', from: 9,  to: 15, color: '#00b8d9' },
    { name: 'iStation (Sovereign AI)', from: 16, to: 22, color: '#00ab89' },
    { name: 'Tstation',           from: 23, to: 28, color: '#f4a900' },
    { name: 'User Journey',       from: 29, to: 31, color: '#ff6b6b' },
    { name: 'CAS · CBT',          from: 32, to: 40, color: '#4f7cff' },
    { name: 'Success Stories',    from: 41, to: 50, color: '#7c5cff' },
    { name: 'Business Impact',    from: 51, to: 51, color: '#00e5ff' },
    { name: 'Closing',            from: 52, to: 52, color: '#00ab89' },
  ],

  // Slides that get the particle signature effect (hero & closing)
  particleSlides: [1, 52],

  // Transition overrides per slide number (incoming slide).
  // Defaults: chapter boundary => wipe, inside chapter => fade/push.
  transitionOverrides: {
    1: 'zoom',
    52: 'zoom',
  },
};
