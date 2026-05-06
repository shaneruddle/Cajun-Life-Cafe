import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { normalizeImageUrl } from '../../utils/images';
import { FirebaseImage } from '../ui/FirebaseImage';
import { ImageModal } from '../ui/ImageModal';

interface MenuItemCardProps {
  item: MenuItem;
  language: 'en' | 'zh' | 'ru' | 'th';
  getLocalizedName: (item: MenuItem) => string;
  getLocalizedDesc: (item: MenuItem) => string;
  renderPrice: (item: MenuItem) => React.ReactNode;
  priority?: boolean;
}

const MenuItemCard: React.FC<MenuItemCardProps> = React.memo(({ 
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
      className="flex flex-col gap-0 group items-stretch bg-white rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all w-full max-w-[550px] mx-auto overflow-hidden"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' } as React.CSSProperties}
    >
      {/* Image Container: 550px width (via card max-w), 400px height, edge-to-edge */}
      <div 
        className="w-full h-[400px] overflow-hidden flex-shrink-0 bg-gray-50 cursor-pointer relative"
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
          width="600"
          height="400"
        />
      </div>

      <div className="flex-1 w-full p-6 text-left flex flex-col justify-start">
        <div className="flex items-baseline w-full gap-2 mb-3">
          <h3 className="text-xl sm:text-2xl font-bold text-ink group-hover:text-terracotta transition-colors leading-tight">
            {localizedName}
          </h3>
          {!isMultiPrice && (
            <>
              <div className="flex-1 border-b border-dotted border-gray-200 mb-1" />
              <span className="text-xl sm:text-2xl font-black text-terracotta whitespace-nowrap shrink-0">
                ฿{item.price}
              </span>
            </>
          )}
        </div>
        
        <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3">
          {(() => {
            const desc = getLocalizedDesc(item);
            const parts = desc.split('/');
            
            if (isMultiPrice) {
              if (parts.length > prices.length) {
                return parts[0];
              } else if (parts.length === prices.length) {
                return "";
              }
            }
            return parts[0];
          })()}
        </p>
        
        <div className="mt-auto">
          {renderPrice(item)}
        </div>
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

MenuItemCard.displayName = 'MenuItemCard';

export default MenuItemCard;
