/**
 * English is the source catalog. Keep these keys flat so a missing translation
 * is easy to spot and so catalog parity can be checked without walking a tree.
 */
export const enCatalog = {
  "common.languageEnglish": "English",
  "common.languageArabic": "العربية",
  "common.englishDescription": "English",
  "common.arabicDescription": "Modern Standard Arabic",

  "accessibility.closeSheet": "Close sheet",
  "accessibility.close": "Close",
  "accessibility.openSettings": "Open settings",
  "accessibility.changeSpokenLanguage": "Change spoken language",
  "accessibility.reverseTranslationLanguages": "Reverse translation languages",
  "accessibility.changeTranslationLanguage": "Change translation language",
  "accessibility.searchLanguages": "Search languages",
  "accessibility.murmurBrand": "Murmur",
  "accessibility.setupStep": "Setup step {current} of {total}",

  "onboarding.agreeAndContinue": "Agree and Continue",
  "onboarding.continue": "Continue",
  "onboarding.firstSetup": "First setup",
  "onboarding.languagesTitle": "Which way are we translating?",
  "onboarding.listen": "Listen",
  "onboarding.beforeListen": "Before you listen",
  "onboarding.aiProcessingNotice": "AI processing notice",
  "onboarding.sourceLabel": "I will speak",
  "onboarding.targetLabel": "Translate into",
  "onboarding.welcomeCopy": "Choose a direction, listen, and read clear captions in real time.",
  "onboarding.welcomeTitle": "Talk with anyone, in any language.",
  "onboarding.privacyDataFlow":
    "When you tap Listen, Murmur sends live audio through Q9 Labs on Cloudflare to OpenAI for transcription, translation, and translated speech.",
  "onboarding.privacyDataUse":
    "Murmur uses this data only to provide translation, speech output, safety reports, diagnostics, and abuse prevention.",
  "onboarding.noHistory": "Murmur does not save audio or transcript history by default.",
  "onboarding.consent": "I agree to share this data with these services for live AI translation.",

  "home.audioSaveError": "Could not save the audio setting. Please try again.",
  "home.localDataDeleted":
    "Local Murmur data deleted. Privacy acknowledgement, install id, and rating eligibility were cleared.",
  "home.localDataDeleteError": "Could not delete local data. Please try again.",
  "home.identityReset": "Accountless identity reset. The next session will use a fresh install id.",
  "home.autoDetect": "Auto detect",
  "home.listening": "Listening",
  "home.microphoneAccessNeeded": "Microphone access needed",
  "home.readyToTranslate": "Ready to translate",
  "home.speakNowCaptions": "Speak now. Captions will appear here.",
  "home.allowMicrophone": "Allow microphone access to start listening.",
  "home.chooseDirection": "Choose a direction, then tap Listen.",
  "home.timelineListening": "Listening. The conversation will appear here.",
  "home.timelineEmpty": "The conversation appears here once you start.",
  "home.listen": "Listen",
  "home.stop": "Stop",
  "home.reportReceived": "Report received: {receiptId}",
  "home.translationFailed": "Translation failed",
  "home.translating": "Translating…",

  "settings.title": "Settings",
  "settings.appLanguage": "App language",
  "settings.languageTitle": "App language",
  "settings.languageSaveError": "Could not save the app language. Please try again.",
  "settings.shareMurmur": "Share Murmur",
  "settings.privacyPolicy": "Privacy policy",
  "settings.termsOfUse": "Terms of use",
  "settings.supportDataRequests": "Support & data requests",
  "settings.deleteLocalData": "Delete local data",
  "settings.sessionDiagnostics": "Session diagnostics",
  "settings.reportTranslation": "Report translation",
  "settings.resetMurmurIdentity": "Reset Murmur Identity",

  "languagePicker.speakIn": "Speak in",
  "languagePicker.translateTo": "Translate to",
  "languagePicker.search": "Search",
  "languagePicker.autoDetect": "Auto detect",
  "languagePicker.liveMultilingualSource": "Live multilingual source",

  "report.title": "Report translation",
  "report.noCommittedTranslations": "No committed translations yet.",
  "report.inaccurate": "Inaccurate",
  "report.wrongLanguage": "Wrong language",
  "report.harmful": "Harmful",
  "report.speech": "Speech",
  "report.other": "Other",

  "diagnostics.title": "Diagnostics",
  "diagnostics.downloaded": "Diagnostics downloaded.",
  "diagnostics.fileReadyToShare": "Diagnostics file ready to share.",
  "diagnostics.fileCouldNotPrepare": "Diagnostics file could not be prepared.",
  "diagnostics.session": "Session",
  "diagnostics.spans": "Spans",
  "diagnostics.mic": "Mic",
  "diagnostics.speech": "Speech",
  "diagnostics.on": "on",
  "diagnostics.off": "off",
  "diagnostics.copied": "Diagnostics copied.",
  "diagnostics.copyReport": "Copy report",
  "diagnostics.downloadText": "Download .txt",
  "diagnostics.share": "Share",
  "diagnostics.fileShared": "Diagnostics file shared.",
  "diagnostics.shared": "Diagnostics shared.",
  "diagnostics.couldNotShare": "Diagnostics could not be shared.",
  "diagnostics.firstSourceTranscript": "First source transcript",
  "diagnostics.firstTranslatedTranscript": "First translated transcript",
  "diagnostics.noSpans": "No spans yet",

  "status.ended": "Ended",
  "status.healthOk": "Health OK",
  "status.networkDegraded": "Network degraded",
  "status.recovering": "Recovering",
  "status.microphone": "Microphone",
  "status.disconnected": "Disconnected",
  "status.connecting": "Connecting",
  "status.ready": "Ready",
  "status.degraded": "Degraded",
  "status.ok": "OK",
  "status.needsSetup": "Needs setup",

  "error.providerUnconfigured":
    "Live translation is not connected yet. Please try again after setup is complete.",
  "error.providerUnavailable": "Live translation provider is unavailable. Please try again.",
  "error.workerUnavailable":
    "Could not reach Murmur translation service. Check your connection and try again.",
  "error.microphonePermission": "Microphone access is required to translate speech.",
  "error.microphoneStart": "Could not start the microphone. Please try again.",
  "error.transport": "Translation connection was interrupted. Please try again. ({error})",
  "error.realtimeFailure": "Live translation failed. Please try again. ({error})",
  "error.unavailable": "Live translation is unavailable. Please try again. ({error})",
  "error.reportRateLimited": "Too many reports were sent from this session. Please try again later.",
  "error.reportFailed": "Could not send the report. Please try again.",

  "audio.turnTranslatedOff": "Turn translated audio off",
  "audio.turnTranslatedOn": "Turn translated audio on",
} as const;

export type MessageKey = keyof typeof enCatalog;

export const arCatalog: { [Key in MessageKey]: string } = {
  "common.languageEnglish": "English",
  "common.languageArabic": "العربية",
  "common.englishDescription": "الإنجليزية",
  "common.arabicDescription": "العربية الفصحى",

  "accessibility.closeSheet": "إغلاق اللوحة",
  "accessibility.close": "إغلاق",
  "accessibility.openSettings": "فتح الإعدادات",
  "accessibility.changeSpokenLanguage": "تغيير لغة الكلام",
  "accessibility.reverseTranslationLanguages": "تبديل اللغتين",
  "accessibility.changeTranslationLanguage": "تغيير لغة الترجمة",
  "accessibility.searchLanguages": "البحث عن اللغات",
  "accessibility.murmurBrand": "Murmur",
  "accessibility.setupStep": "خطوة الإعداد {current} من {total}",

  "onboarding.agreeAndContinue": "موافقة ومتابعة",
  "onboarding.continue": "متابعة",
  "onboarding.firstSetup": "الإعداد الأولي",
  "onboarding.languagesTitle": "ما اتجاه الترجمة؟",
  "onboarding.listen": "استماع",
  "onboarding.beforeListen": "قبل الاستماع",
  "onboarding.aiProcessingNotice": "إشعار بمعالجة الذكاء الاصطناعي",
  "onboarding.sourceLabel": "سأتحدث",
  "onboarding.targetLabel": "الترجمة إلى",
  "onboarding.welcomeCopy": "اختر اتجاهًا، واستمع، واقرأ تسميات توضيحية واضحة في الوقت الفعلي.",
  "onboarding.welcomeTitle": "تحدث مع أي شخص، بأي لغة.",
  "onboarding.privacyDataFlow":
    "عند الضغط على «استماع»، يرسل \u2068Murmur\u2069 الصوت المباشر عبر \u2068Q9 Labs\u2069 على \u2068Cloudflare\u2069 إلى \u2068OpenAI\u2069 لتحويل الكلام إلى نص وترجمته وإنتاج كلام مترجم.",
  "onboarding.privacyDataUse":
    "يستخدم \u2068Murmur\u2069 هذه البيانات فقط لتوفير الترجمة، والإخراج الصوتي، وتقارير السلامة، والتشخيص، ومنع إساءة الاستخدام.",
  "onboarding.noHistory": "لا يحفظ \u2068Murmur\u2069 الصوت أو سجل النصوص افتراضيًا.",
  "onboarding.consent": "أوافق على مشاركة هذه البيانات مع هذه الخدمات لإجراء ترجمة مباشرة بالذكاء الاصطناعي.",

  "home.audioSaveError": "تعذر حفظ إعداد الصوت. يُرجى المحاولة مرة أخرى.",
  "home.localDataDeleted":
    "حُذفت بيانات \u2068Murmur\u2069 المحلية. مُسح إقرار الخصوصية ومعرّف التثبيت وأهلية التقييم.",
  "home.localDataDeleteError": "تعذر حذف البيانات المحلية. يُرجى المحاولة مرة أخرى.",
  "home.identityReset": "تمت إعادة ضبط الهوية من دون حساب. ستستخدم الجلسة التالية معرّف تثبيت جديدًا.",
  "home.autoDetect": "اكتشاف تلقائي",
  "home.listening": "جارٍ الاستماع",
  "home.microphoneAccessNeeded": "يلزم السماح بالوصول إلى الميكروفون",
  "home.readyToTranslate": "جاهز للترجمة",
  "home.speakNowCaptions": "تحدث الآن. ستظهر التسميات التوضيحية هنا.",
  "home.allowMicrophone": "اسمح بالوصول إلى الميكروفون لبدء الاستماع.",
  "home.chooseDirection": "اختر اتجاهًا، ثم اضغط «استماع».",
  "home.timelineListening": "جارٍ الاستماع. ستظهر المحادثة هنا.",
  "home.timelineEmpty": "ستظهر المحادثة هنا بعد البدء.",
  "home.listen": "استماع",
  "home.stop": "إيقاف",
  "home.reportReceived": "تم استلام البلاغ: \u2068{receiptId}\u2069",
  "home.translationFailed": "فشلت الترجمة",
  "home.translating": "جارٍ الترجمة…",

  "settings.title": "الإعدادات",
  "settings.appLanguage": "لغة التطبيق",
  "settings.languageTitle": "لغة التطبيق",
  "settings.languageSaveError": "تعذر حفظ لغة التطبيق. يُرجى المحاولة مرة أخرى.",
  "settings.shareMurmur": "مشاركة \u2068Murmur\u2069",
  "settings.privacyPolicy": "سياسة الخصوصية",
  "settings.termsOfUse": "شروط الاستخدام",
  "settings.supportDataRequests": "الدعم وطلبات البيانات",
  "settings.deleteLocalData": "حذف البيانات المحلية",
  "settings.sessionDiagnostics": "تشخيص الجلسة",
  "settings.reportTranslation": "الإبلاغ عن الترجمة",
  "settings.resetMurmurIdentity": "إعادة ضبط هوية \u2068Murmur\u2069",

  "languagePicker.speakIn": "التحدث بلغة",
  "languagePicker.translateTo": "الترجمة إلى",
  "languagePicker.search": "بحث",
  "languagePicker.autoDetect": "اكتشاف تلقائي",
  "languagePicker.liveMultilingualSource": "مصدر مباشر متعدد اللغات",

  "report.title": "الإبلاغ عن الترجمة",
  "report.noCommittedTranslations": "لا توجد ترجمات مكتملة بعد.",
  "report.inaccurate": "غير دقيقة",
  "report.wrongLanguage": "لغة غير صحيحة",
  "report.harmful": "ضارة",
  "report.speech": "الكلام",
  "report.other": "أخرى",

  "diagnostics.title": "التشخيص",
  "diagnostics.downloaded": "تم تنزيل بيانات التشخيص.",
  "diagnostics.fileReadyToShare": "ملف التشخيص جاهز للمشاركة.",
  "diagnostics.fileCouldNotPrepare": "تعذر تجهيز ملف التشخيص.",
  "diagnostics.session": "الجلسة",
  "diagnostics.spans": "المقاطع",
  "diagnostics.mic": "الميكروفون",
  "diagnostics.speech": "الصوت",
  "diagnostics.on": "مفعّل",
  "diagnostics.off": "غير مفعّل",
  "diagnostics.copied": "تم نسخ بيانات التشخيص.",
  "diagnostics.copyReport": "نسخ التقرير",
  "diagnostics.downloadText": "تنزيل \u2068.txt\u2069",
  "diagnostics.share": "مشاركة",
  "diagnostics.fileShared": "تمت مشاركة ملف التشخيص.",
  "diagnostics.shared": "تمت مشاركة بيانات التشخيص.",
  "diagnostics.couldNotShare": "تعذرت مشاركة بيانات التشخيص.",
  "diagnostics.firstSourceTranscript": "أول نص من المصدر",
  "diagnostics.firstTranslatedTranscript": "أول نص مترجم",
  "diagnostics.noSpans": "لا توجد مقاطع بعد",

  "status.ended": "انتهت",
  "status.healthOk": "الحالة سليمة",
  "status.networkDegraded": "الشبكة ضعيفة",
  "status.recovering": "جارٍ التعافي",
  "status.microphone": "الميكروفون",
  "status.disconnected": "غير متصل",
  "status.connecting": "جارٍ الاتصال",
  "status.ready": "جاهز",
  "status.degraded": "متراجع",
  "status.ok": "سليم",
  "status.needsSetup": "يلزم الإعداد",

  "error.providerUnconfigured":
    "الترجمة المباشرة غير متصلة بعد. يُرجى المحاولة بعد اكتمال الإعداد.",
  "error.providerUnavailable": "مزوّد الترجمة المباشرة غير متاح. يُرجى المحاولة مرة أخرى.",
  "error.workerUnavailable":
    "تعذر الوصول إلى خدمة ترجمة \u2068Murmur\u2069. تحقق من اتصالك وحاول مرة أخرى.",
  "error.microphonePermission": "يلزم الوصول إلى الميكروفون لترجمة الكلام.",
  "error.microphoneStart": "تعذر تشغيل الميكروفون. يُرجى المحاولة مرة أخرى.",
  "error.transport": "انقطع اتصال الترجمة. يُرجى المحاولة مرة أخرى. (\u2068{error}\u2069)",
  "error.realtimeFailure": "فشلت الترجمة المباشرة. يُرجى المحاولة مرة أخرى. (\u2068{error}\u2069)",
  "error.unavailable": "الترجمة المباشرة غير متاحة. يُرجى المحاولة مرة أخرى. (\u2068{error}\u2069)",
  "error.reportRateLimited": "تم إرسال بلاغات كثيرة من هذه الجلسة. يُرجى المحاولة لاحقًا.",
  "error.reportFailed": "تعذر إرسال البلاغ. يُرجى المحاولة مرة أخرى.",

  "audio.turnTranslatedOff": "إيقاف الصوت المترجم",
  "audio.turnTranslatedOn": "تشغيل الصوت المترجم",
};

export function placeholderNames(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]);
}

export function assertCatalogParity(): void {
  const englishKeys = Object.keys(enCatalog);
  const arabicKeys = Object.keys(arCatalog);
  if (englishKeys.length !== arabicKeys.length || englishKeys.some((key) => !(key in arCatalog))) {
    throw new Error("Arabic catalog keys must exactly match the English catalog");
  }
  for (const key of englishKeys) {
    const englishPlaceholders = placeholderNames(enCatalog[key as MessageKey]).sort();
    const arabicPlaceholders = placeholderNames(arCatalog[key as MessageKey]).sort();
    if (englishPlaceholders.join("\0") !== arabicPlaceholders.join("\0")) {
      throw new Error(`Arabic catalog placeholders do not match for ${key}`);
    }
  }
}
