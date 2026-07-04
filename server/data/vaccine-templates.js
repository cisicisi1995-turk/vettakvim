// Standart aşı/parazit takvimi şablonları (Türkiye'de yaygın uygulama, basitleştirilmiş).
// recommended_age_weeks: ilk uygulama yaşı (hafta)
// repeat_interval_days: tekrar aralığı (gün); tek seferlikse null
module.exports = [
  // --- KÖPEK ---
  { species: 'köpek', vaccine_name: 'İç Parazit', recommended_age_weeks: 3, repeat_interval_days: 90, description: 'İlk uygulama 3. haftada, sonrasında 3 ayda bir tekrar.' },
  { species: 'köpek', vaccine_name: 'Dış Parazit', recommended_age_weeks: 8, repeat_interval_days: 90, description: 'Pire/kene koruması, 3 ayda bir tekrar.' },
  { species: 'köpek', vaccine_name: 'Karma Aşı 1. Doz (DHPPi+L)', recommended_age_weeks: 8, repeat_interval_days: null, description: 'Gençlik hastalığı, parvo, hepatit, parainfluenza, leptospira.' },
  { species: 'köpek', vaccine_name: 'Karma Aşı 2. Doz (DHPPi+L)', recommended_age_weeks: 12, repeat_interval_days: 365, description: '2. doz; sonrasında yılda bir rapel.' },
  { species: 'köpek', vaccine_name: 'Kuduz Aşısı', recommended_age_weeks: 12, repeat_interval_days: 365, description: 'Yasal zorunlu; yılda bir tekrar.' },
  { species: 'köpek', vaccine_name: 'Bronşin (Kennel Cough)', recommended_age_weeks: 8, repeat_interval_days: 365, description: 'Barınak öksürüğü koruması; yılda bir tekrar.' },

  // --- KEDİ ---
  { species: 'kedi', vaccine_name: 'İç Parazit', recommended_age_weeks: 4, repeat_interval_days: 90, description: 'İlk uygulama 4. haftada, sonrasında 3 ayda bir tekrar.' },
  { species: 'kedi', vaccine_name: 'Dış Parazit', recommended_age_weeks: 8, repeat_interval_days: 90, description: 'Pire/kene koruması, 3 ayda bir tekrar.' },
  { species: 'kedi', vaccine_name: 'Karma Aşı 1. Doz (FVRCP)', recommended_age_weeks: 9, repeat_interval_days: null, description: 'Herpes, calici, panleukopenia.' },
  { species: 'kedi', vaccine_name: 'Karma Aşı 2. Doz (FVRCP)', recommended_age_weeks: 12, repeat_interval_days: 365, description: '2. doz; sonrasında yılda bir rapel.' },
  { species: 'kedi', vaccine_name: 'Lösemi Aşısı (FeLV)', recommended_age_weeks: 9, repeat_interval_days: 365, description: 'Kedi lösemi virüsü koruması; yılda bir tekrar.' },
  { species: 'kedi', vaccine_name: 'Kuduz Aşısı', recommended_age_weeks: 12, repeat_interval_days: 365, description: 'Yasal zorunlu; yılda bir tekrar.' },
];
