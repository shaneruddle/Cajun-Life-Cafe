import React from 'react';
import { MenuItem } from '../../types';
import { normalizeImageUrl } from '../../utils/images';
import { FirebaseImage } from '../ui/FirebaseImage';

interface MenuItemCardProps {
  item: MenuItem;
  language: 'en' | 'zh' | 'ru' | 'th';
  getLocalizedName: (item: MenuItem) => string;
  getLocalizedDesc: (item: MenuItem) => string;
  renderPrice: (item: MenuItem) => React.ReactNode;
}

const MenuItemCard: React.FC<MenuItemCardProps> = React.memo(({ 
  item, 
  language, 
  getLocalizedName, 
  getLocalizedDesc, 
  renderPrice 
}) => {
  const prices = [item.price, item.price2, item.price3, item.price4].filter(p => p && p.trim() !== '');
  const isMultiPrice = prices.length > 1;
  
  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 group items-start">
      <div className="w-full sm:w-40 h-48 sm:h-40 rounded-[24px] sm:rounded-[32px] overflow-hidden flex-shrink-0 shadow-lg border-4 border-white bg-gray-100">
        <FirebaseImage 
          src={normalizeImageUrl(item.image)} 
          fallbackSrc="/logo.png"
          alt={item.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
          width="160"
          height="160"
        />
      </div>
      <div className="flex-1 pt-0 sm:pt-2">
        <div className="flex justify-between items-baseline gap-4 mb-2 sm:mb-3">
          <h3 className="text-2xl sm:text-3xl font-bold text-ink group-hover:text-terracotta transition-colors leading-tight">
            {getLocalizedName(item)}
          </h3>
          {!isMultiPrice && (
            <span className="text-2xl sm:text-3xl font-bold text-terracotta">฿{item.price}</span>
          )}
        </div>
        <p className="text-gray-500 text-base sm:text-lg italic leading-relaxed mb-4">
          {getLocalizedDesc(item).split('/')[0]}
        </p>
        
        {renderPrice(item)}
      </div>
    </div>
  );
});

MenuItemCard.displayName = 'MenuItemCard';

export default MenuItemCard;
