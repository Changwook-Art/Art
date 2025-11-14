// ESG Stock Data - Sample Data (MVP Version)
// This will be replaced with real API calls in future versions

const ESG_DATA = {
    'AAPL': {
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        industry: 'Technology',
        environmental: {
            score: 90,
            activities: [
                'Committed to carbon neutrality by 2030',
                '100% renewable energy for global operations',
                'Recycled materials used in all products',
                'Water conservation in manufacturing',
                'Zero waste to landfill certification'
            ]
        },
        social: {
            score: 82,
            activities: [
                'Supply chain labor standards program',
                'Diversity and inclusion initiatives',
                'Employee education benefits up to $12,000/year',
                'Comprehensive health and wellness programs',
                'Community education initiatives'
            ]
        },
        governance: {
            score: 83,
            activities: [
                'Independent board of directors',
                'Transparent financial reporting',
                'Strong anti-corruption policies',
                'Executive compensation tied to ESG goals',
                'Regular shareholder engagement'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'MSFT': {
        companyName: 'Microsoft Corporation',
        ticker: 'MSFT',
        industry: 'Technology',
        environmental: {
            score: 93,
            activities: [
                'Carbon negative by 2030 goal',
                'Removing historical carbon emissions by 2050',
                '$1 billion climate innovation fund',
                'Sustainable campus development',
                'Water positive by 2030'
            ]
        },
        social: {
            score: 88,
            activities: [
                'AI for accessibility programs',
                '$500 million affordable housing initiative',
                'Skills training for digital economy',
                'Living wage commitment for all workers',
                'Diversity hiring targets and transparency'
            ]
        },
        governance: {
            score: 90,
            activities: [
                'Strong board independence',
                'Comprehensive cybersecurity governance',
                'Ethical AI principles and oversight',
                'Transparent lobbying disclosures',
                'Shareholder rights protection'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'GOOGL': {
        companyName: 'Alphabet Inc. (Google)',
        ticker: 'GOOGL',
        industry: 'Technology',
        environmental: {
            score: 91,
            activities: [
                'Carbon-free energy by 2030',
                'Largest corporate renewable energy purchaser',
                'AI-powered environmental solutions',
                'Circular economy product design',
                'Water stewardship initiatives'
            ]
        },
        social: {
            score: 79,
            activities: [
                'Digital skills training programs',
                'Support for small businesses',
                'Crisis response and relief efforts',
                'Product accessibility features',
                'Employee volunteer programs'
            ]
        },
        governance: {
            score: 75,
            activities: [
                'Dual-class share structure debates',
                'Transparency in content moderation',
                'Privacy protection measures',
                'AI ethics committees',
                'Regular ESG reporting'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'TSLA': {
        companyName: 'Tesla, Inc.',
        ticker: 'TSLA',
        industry: 'Automotive & Energy',
        environmental: {
            score: 95,
            activities: [
                'Accelerating world transition to sustainable energy',
                'Zero-emission electric vehicles',
                'Solar and battery energy storage solutions',
                'Gigafactory sustainability design',
                'Battery recycling program'
            ]
        },
        social: {
            score: 68,
            activities: [
                'Employee safety improvement programs',
                'Diversity in engineering initiative',
                'STEM education support',
                'Local community engagement',
                'Worker satisfaction surveys'
            ]
        },
        governance: {
            score: 62,
            activities: [
                'Board diversity improvements',
                'Enhanced disclosure practices',
                'Risk management framework',
                'Succession planning development',
                'Shareholder communication channels'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'AMZN': {
        companyName: 'Amazon.com, Inc.',
        ticker: 'AMZN',
        industry: 'E-commerce & Cloud',
        environmental: {
            score: 77,
            activities: [
                'Climate Pledge: Net-zero carbon by 2040',
                '100,000 electric delivery vehicles ordered',
                '$2 billion Climate Pledge Fund',
                'Renewable energy projects',
                'Shipment Zero initiative'
            ]
        },
        social: {
            score: 71,
            activities: [
                '$15 minimum wage for all employees',
                'Upskilling programs for 100,000 employees',
                'Amazon Future Engineer program',
                'Disaster relief and community support',
                'Workplace safety investments'
            ]
        },
        governance: {
            score: 76,
            activities: [
                'Independent board leadership',
                'Enhanced shareholder engagement',
                'Tax transparency reporting',
                'AI ethics guidelines',
                'Supply chain auditing'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'META': {
        companyName: 'Meta Platforms, Inc.',
        ticker: 'META',
        industry: 'Social Media',
        environmental: {
            score: 84,
            activities: [
                'Net zero emissions operations achieved',
                '100% renewable energy for facilities',
                'Sustainable data center design',
                'Water restoration projects',
                'LEED certified buildings'
            ]
        },
        social: {
            score: 65,
            activities: [
                'Digital literacy programs',
                'Small business support tools',
                'Crisis response initiatives',
                'Content safety investments',
                'Mental health resources'
            ]
        },
        governance: {
            score: 58,
            activities: [
                'Content moderation oversight',
                'Privacy policy improvements',
                'Board diversity initiatives',
                'Transparency reports',
                'User data protection measures'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'NVDA': {
        companyName: 'NVIDIA Corporation',
        ticker: 'NVDA',
        industry: 'Semiconductors',
        environmental: {
            score: 81,
            activities: [
                'Energy-efficient GPU architecture',
                'AI for climate research support',
                'Green building certifications',
                'Renewable energy procurement',
                'Product lifecycle management'
            ]
        },
        social: {
            score: 85,
            activities: [
                'AI education and research grants',
                'University partnerships for AI development',
                'Employee stock purchase program',
                'Diversity in tech initiatives',
                'STEM education support'
            ]
        },
        governance: {
            score: 87,
            activities: [
                'Strong board oversight',
                'Transparent executive compensation',
                'Shareholder rights protection',
                'Ethics and compliance program',
                'Regular ESG disclosures'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'JPM': {
        companyName: 'JPMorgan Chase & Co.',
        ticker: 'JPM',
        industry: 'Financial Services',
        environmental: {
            score: 78,
            activities: [
                '$2.5 trillion sustainable finance commitment',
                'Net zero emissions by 2050',
                'Green bond issuance',
                'Financing renewable energy projects',
                'Climate risk assessment integration'
            ]
        },
        social: {
            score: 80,
            activities: [
                '$30 billion racial equity commitment',
                'Small business lending programs',
                'Financial health and wealth creation',
                'Affordable housing investments',
                'Skills training initiatives'
            ]
        },
        governance: {
            score: 88,
            activities: [
                'Strong risk management framework',
                'Board diversity and independence',
                'Transparent executive pay',
                'Compliance and ethics program',
                'Shareholder engagement'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'JNJ': {
        companyName: 'Johnson & Johnson',
        ticker: 'JNJ',
        industry: 'Healthcare',
        environmental: {
            score: 85,
            activities: [
                'Carbon neutrality achieved in operations',
                'Sustainable packaging initiatives',
                'Water conservation programs',
                'Renewable energy investments',
                'Waste reduction goals'
            ]
        },
        social: {
            score: 89,
            activities: [
                'Global health equity initiatives',
                'Access to medicine programs',
                'Employee health and safety excellence',
                'Diversity and inclusion leadership',
                'Community health programs'
            ]
        },
        governance: {
            score: 91,
            activities: [
                'Strong board independence',
                'Comprehensive compliance program',
                'Transparent product safety reporting',
                'Ethical business practices',
                'Shareholder rights'
            ]
        },
        lastUpdated: 'November 2024'
    },
    'PG': {
        companyName: 'Procter & Gamble Co.',
        ticker: 'PG',
        industry: 'Consumer Goods',
        environmental: {
            score: 82,
            activities: [
                'Net zero greenhouse gas emissions by 2040',
                'Sustainable packaging innovation',
                '100% renewable electricity goal',
                'Forest positive by 2030',
                'Water conservation in products'
            ]
        },
        social: {
            score: 86,
            activities: [
                'Gender equality advocacy',
                'Community impact programs',
                'Clean water access initiatives',
                'Education and skills development',
                'Diversity and inclusion programs'
            ]
        },
        governance: {
            score: 89,
            activities: [
                'Board diversity and experience',
                'Transparent reporting practices',
                'Strong ethical standards',
                'Shareholder engagement',
                'Risk oversight and management'
            ]
        },
        lastUpdated: 'November 2024'
    }
};

// Function to get ESG data for a ticker
// This structure makes it easy to replace with API calls in the future
function getESGData(ticker) {
    return ESG_DATA[ticker.toUpperCase()] || null;
}

// Function to calculate overall ESG score
function calculateOverallScore(esgData) {
    if (!esgData) return 0;
    const envScore = esgData.environmental.score;
    const socialScore = esgData.social.score;
    const govScore = esgData.governance.score;
    return Math.round((envScore + socialScore + govScore) / 3);
}

// Function to get rating based on score
function getScoreRating(score) {
    if (score >= 90) return '⭐⭐⭐⭐⭐ Excellent';
    if (score >= 80) return '⭐⭐⭐⭐ Very Good';
    if (score >= 70) return '⭐⭐⭐ Good';
    if (score >= 60) return '⭐⭐ Fair';
    return '⭐ Needs Improvement';
}
