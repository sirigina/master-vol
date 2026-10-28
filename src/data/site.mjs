// Site-wide settings. Rename the site or swap the affiliate tag here only.
export const site = {
  name: 'MasterVol',
  description:
    'Learn options the way professional volatility traders think about them: interactive lessons, real market snapshots, and two levels of explanation.',
  url: 'https://mastervol.com',
  amazonTag: 'YOUR-AMAZON-TAG-20', // TODO: your Amazon Associates tag
  // ASIN for Natenberg, Option Volatility and Pricing, 2nd ed. (verify before launch)
  bookAsin: '0071818774',
};

export const bookLink = () => `https://www.amazon.com/dp/${site.bookAsin}?tag=${site.amazonTag}`;
