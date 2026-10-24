export interface TranslationSchema {
  app: {
    title: string;
    description: string;
  };
  mascot: {
    state: {
      idle: string;
      waving: string;
      alert: string;
      sleeping: string;
      dragOver: string;
      processing: string;
    };
  };
  ui: {
    tools: string;
    settings: string;
    close: string;
    minimize: string;
    language: string;
    switchLanguage: string;
    dropHint: string;
    readyPlaceholder: string;
    pin: string;
    unpin: string;
    move: string;
    moodCycle: string;
    hide: string;
  };
  settings: {
    title: string;
    subtitle: string;
    tabAppearance: string;
    tabBehavior: string;
    tabWindow: string;
    windowBehavior: string;
    alwaysOnTop: string;
    alwaysOnTopDesc: string;
    showInTaskbar: string;
    showInTaskbarDesc: string;
    mascotBehavior: string;
    autonomousMode: string;
    autonomousModeDesc: string;
    globalCursor: string;
    globalCursorDesc: string;
    soundEnabled: string;
    soundEnabledDesc: string;
    sleepDelay: string;
    sleep1m: string;
    sleep3m: string;
    sleep5m: string;
    sleepOff: string;
    appearance: string;
    scale: string;
    opacity: string;
    animSpeed: string;
    speedChill: string;
    speedNormal: string;
    speedEnergetic: string;
    actions: string;
    resetPosition: string;
    quit: string;
  };
}

export const fa: TranslationSchema = {
  app: {
    title: 'موچی دسکتاپ',
    description: 'دستیار هوشمند و تعاملی رومیزی',
  },
  mascot: {
    state: {
      idle: 'آماده به کار',
      waving: 'خوش‌آمدگویی',
      alert: 'هوشیار و گوش به زنگ',
      sleeping: 'خوابیده',
      dragOver: 'فایل را رها کنید!',
      processing: 'در حال پردازش...',
    },
  },
  ui: {
    tools: 'جعبه ابزار',
    settings: 'تنظیمات',
    close: 'بستن',
    minimize: 'کوچک کردن',
    language: 'تغییر زبان',
    switchLanguage: 'English',
    dropHint: 'فایل را اینجا بیندازید تا بررسی شود',
    readyPlaceholder: 'مدل سه‌بعدی موچی به زودی بارگذاری می‌شود...',
    pin: 'همیشه روبرو',
    unpin: 'حالت عادی پنجره',
    move: 'جابه‌جایی موچی',
    moodCycle: 'تغییر حالت روحی',
    hide: 'مخفی کردن',
  },
  settings: {
    title: 'تنظیمات موچی',
    subtitle: 'شخصی‌سازی ظاهر و رفتار',
    tabAppearance: 'ظاهر',
    tabBehavior: 'رفتار',
    tabWindow: 'پنجره',
    windowBehavior: 'رفتار پنجره',
    alwaysOnTop: 'همیشه روی همه پنجره‌ها',
    alwaysOnTopDesc: 'موچی بالای تمام برنامه‌ها و پنجره‌ها شناور می‌ماند',
    showInTaskbar: 'نمایش آیکون در تسک‌بار',
    showInTaskbarDesc: 'آیکون برنامه در نوار وظیفه ویندوز نشان داده شود',
    mascotBehavior: 'هوش و تعامل موچی',
    autonomousMode: 'حیات و حرکت خودکار',
    autonomousModeDesc: 'موچی خودش نگاه می‌کند، خوش‌آمد می‌گوید و می‌خوابد',
    globalCursor: 'تعقیب سراسری ماوس',
    globalCursorDesc: 'نگاه و سر موچی نشانگر ماوس را در کل مانیتور دنبال کند',
    soundEnabled: 'افکت‌های صوتی تعاملی',
    soundEnabledDesc: 'پخش صداهای مصنوعی دلنشین هنگام کلیک و لمس',
    sleepDelay: 'زمان خواب خودکار',
    sleep1m: '۱ دقیقه',
    sleep3m: '۳ دقیقه',
    sleep5m: '۵ دقیقه',
    sleepOff: 'خاموش',
    appearance: 'ظاهر و اندازه',
    scale: 'سایز موچی',
    opacity: 'شفافیت',
    animSpeed: 'سرعت انیمیشن‌ها',
    speedChill: 'آرام',
    speedNormal: 'عادی',
    speedEnergetic: 'پرانرژی',
    actions: 'عملیات سریع',
    resetPosition: 'بازنشانی مکان به گوشه',
    quit: 'خروج کامل از برنامه',
  },
};
