// src\lib\constants.ts

export const RESTAURANT_MAP_LINK = "https://maps.app.goo.gl/QRCNh3tuhkuYcDn76";
export const WHATSAPP_NUMBER = "916356350086";

export const getWhatsAppInquiryLink = (customText?: string) => {
  const text = customText || "Hi ViTa Cuisine! I would like to make an inquiry.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
};

export const WHATSAPP_LINK = getWhatsAppInquiryLink("Hi ViTa Cuisine! I would like to inquire about your daily tiffin & catering services.");

