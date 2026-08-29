import { motion } from 'framer-motion';

export const FireballLogo = ({ size = 'md', animate = true }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  return (
    <motion.div
      className={`${sizes[size]} rounded-full relative`}
      animate={animate ? { rotate: 360 } : {}}
      transition={animate ? { duration: 8, repeat: Infinity, ease: 'linear' } : {}}
      style={{
        background: 'conic-gradient(from 0deg, #F97316, #EF4444, #8B5CF6, #3B82F6, #F97316)',
        filter: 'blur(0.5px)'
      }}
    >
      <div 
        className="absolute inset-[2px] rounded-full bg-white dark:bg-slate-900"
        style={{ opacity: 0.3 }}
      />
    </motion.div>
  );
};

export default FireballLogo;
