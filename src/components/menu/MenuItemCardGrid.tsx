import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { normalizeImageUrl } from '../../utils/images';
import { FirebaseImage } from '../ui/FirebaseImage';
import { ImageModal } from '../ui/ImageModal';

interface MenuItemCardGridProps {
  item: MenuItem;
  language: 'en' | 'zh' | 'ru' | 'th';
  getLocalizedName: (item: MenuItem) => string;
  getLocalizedDesc: (item: MenuItem) => string;
  renderPrice: (item: MenuItem) => React.ReactNode;
  priority?: boolean;
}

const MenuItemCardGrid: React.FC<MenuItemCardGridProps> = React.memo(({ 
  item, 
  language, 
  getLocalizedName, 
  getLocalizedDesc, 
  renderPrice,
  priority = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const prices = [item.price, item.price2, item.price3, item.price4].filter(p => p && p.trim() !== '');
  const isMultiPrice = prices.length > 1;
  const imageUrl = normalizeImageUrl(item.primaryPhotoPath || item.image);
  const localizedName = getLocalizedName(item);
  
  return (
    <div 
      className="bg-white p-5 rounded-[40px] shadow-sm flex flex-col group h-full border border-gray-100 hover:shadow-xl transition-all duration-300 w-full max-w-[550px] mx-auto"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' } as React.CSSProperties}
    >
      <div 
        className="relative w-full aspect-[3/2] mb-4 sm:mb-5 overflow-hidden rounded-[20px] sm:rounded-[32px] cursor-pointer shadow-inner bg-gray-50 flex-shrink-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        aria-label="Enlarge image"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { 
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setIsModalOpen(true); 
          }
        }}
      >
        <FirebaseImage 
          src={imageUrl} 
          fallbackSrc="/logo.png"
          alt={localizedName} 
          className="w-full h-full object-cover"
          priority={priority}
          aspectRatio="3/2"
        />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-baseline w-full gap-2 mb-2 sm:mb-3">
          <h3 className="text-xl sm:text-2xl font-bold text-ink leading-tight group-hover:text-terracotta transition-colors">{localizedName}</h3>
          {item.price && (
            <>
              <div className="flex-1 border-b border-dotted border-gray-200 mb-1" />
              <span className="text-xl sm:text-2xl font-black text-terracotta whitespace-nowrap shrink-0">฿{item.price.replace('฿', '').trim()}</span>
            </>
          )}
        </div>
        
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-1 flex-1">
          {getLocalizedDesc(item)}
        </p>
        
        {renderPrice(item)}
      </div>

      <ImageModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        src={imageUrl}
        alt={localizedName}
      />
    </div>
  );
});

MenuItemCardGrid.displayName = 'MenuItemCardGrid';

export default MenuItemCardGrid;
