/**
 * Apple-like Animation Presets
 * Smooth, subtle animations inspired by Apple's design language
 */

import { Variants, Transition } from 'framer-motion'

// Common transition presets
export const transitions = {
  smooth: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
  gentle: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
    mass: 1,
  },
  quick: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 0.5,
  },
  ease: {
    type: 'tween' as const,
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1], // Apple's ease-in-out curve
  },
  easeOut: {
    type: 'tween' as const,
    duration: 0.25,
    ease: [0, 0, 0.2, 1], // Apple's ease-out curve
  },
  easeIn: {
    type: 'tween' as const,
    duration: 0.25,
    ease: [0.4, 0, 1, 1], // Apple's ease-in curve
  },
} satisfies Record<string, Transition>

// Fade animations
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.ease,
  },
  exit: {
    opacity: 0,
    transition: transitions.easeOut,
  },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: transitions.easeOut,
  },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: transitions.easeOut,
  },
}

// Scale animations
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.easeOut,
  },
}

export const scaleInCenter: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: transitions.easeOut,
  },
}

// Slide animations
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: transitions.easeOut,
  },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: transitions.easeOut,
  },
}

// Stagger container for lists
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
}

// Card hover animations
export const cardHover = {
  scale: 1.02,
  y: -4,
  transition: transitions.quick,
}

export const cardTap = {
  scale: 0.98,
  transition: transitions.quick,
}

// Button animations
export const buttonHover = {
  scale: 1.05,
  transition: transitions.quick,
}

export const buttonTap = {
  scale: 0.95,
  transition: transitions.quick,
}

// Modal animations
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.ease,
  },
  exit: {
    opacity: 0,
    transition: transitions.easeOut,
  },
}

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: transitions.easeOut,
  },
}

// Page transition
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
      ease: [0, 0, 0.2, 1],
    },
  },
}

// Loading spinner animation
export const spinnerRotate = {
  rotate: 360,
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'linear',
  },
}

// Pulse animation
export const pulse: Variants = {
  hidden: { opacity: 0.5, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatType: 'reverse' as const,
      ease: 'easeInOut',
    },
  },
}

// Toast notification animation
export const toastSlideIn: Variants = {
  hidden: { opacity: 0, y: -20, x: '-50%' },
  visible: {
    opacity: 1,
    y: 0,
    x: '-50%',
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    y: -20,
    x: '-50%',
    transition: transitions.easeOut,
  },
}

// Dropdown menu animation
export const dropdownMenu: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.quick,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: transitions.easeOut,
  },
}

// Tab animation
export const tabContent: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: transitions.easeOut,
  },
}










