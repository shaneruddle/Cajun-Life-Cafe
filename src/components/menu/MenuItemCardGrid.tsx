import React from 'react';
import { MenuItem } from '../../types';
import { normalizeImageUrl } from '../../utils/images';
import { FirebaseImage } from '../ui/FirebaseImage';

interface MenuItemCardGridProps {
  item: MenuItem;
  language: 'en' | 'zh' | 'ru' | 'th';
  getLocalizedName: (item: MenuItem) => string;
  getLocalizedDesc: (item: MenuItem) => string;
  renderPrice: (item: MenuItem) => React.ReactNode;
}

const MenuItemCardGrid: React.FC<MenuItemCardGridProps> = React.memo(({ 
  item, 
  language, 
  getLocalizedName, 
  getLocalizedDesc, 
  renderPrice 
}) => {
  const prices = [item.price, item.price2, item.price3, item.price4].filter(p => p && p.trim() !== '');
  const isMultiPrice = prices.length > 1;
  
  return (
    <div className="bg-white p-4 sm:p-5 rounded-[24px] sm:rounded-[32px] shadow-sm flex flex-col group h-full border border-gray-50">
      <div className="relative h-32 sm:h-40 mb-3 sm:mb-4 overflow-hidden rounded-[20px] sm:rounded-[24px]">
        <FirebaseImage 
          src={normalizeImageUrl(item.image)} 
          fallbackSrc="/logo.png"
          alt={item.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
          width="200"
          height="160"
        />
        {!isMultiPrice && (
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white/90 backdrop-blur-sm px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-terracotta font-bold text-xs sm:text-sm shadow-sm">
            ฿{item.price}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1 sm:mb-2">
          <h3 className="text-base sm:text-lg font-bold text-ink leading-tight">{getLocalizedName(item)}</h3>
          {!item.image && !isMultiPrice && <span className="text-terracotta font-bold text-sm sm:text-base">฿{item.price}</span>}
        </div>
        
        <p className="text-gray-500 text-[10px] sm:text-xs leading-relaxed line-clamp-3 mb-3 sm:mb-4 flex-1">
          {(() => {
            const desc = getLocalizedDesc(item);
            const parts = desc.split('/');
            
            if (isMultiPrice) {
              if (parts.length > prices.length) {
                // Format: Description / Label 1 / Label 2
                return parts[0];
              } else if (parts.length === prices.length) {
                // Format: Label 1 / Label 2 (no main description)
                return "Multiple options available";
              }
            }
            return desc.split('/')[0];
          })()}
        </p>

        {renderPrice(item)}
      </div>
    </div>
  );
});

MenuItemCardGrid.displayName = 'MenuItemCardGrid';

export default MenuItemCardGrid;
