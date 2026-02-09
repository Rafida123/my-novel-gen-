
export const DIALOGUE_ARCHETYPES: Record<string, any[]> = {
  'Soft/Gentle': [
    {
      name: 'Whispering Willow',
      gender: 'Female',
      age: 'Late teens',
      species: 'Dryad / Nature Spirit',
      faceVibe: 'Soft & Ethereal',
      voice: 'Whispery and melodic',
      traits: 'Compassionate, Serene, Gentle',
      example: 'The breeze knows your secrets, but I will keep them safe for you.'
    },
    {
      name: 'Gentle Guardian',
      gender: 'Male',
      age: 'Mid 40s',
      species: 'Human',
      faceVibe: 'Mature & Kind',
      voice: 'Warm baritone, calm',
      traits: 'Protective, Patient, Wise',
      example: 'Take your time, child; the world isn’t going anywhere today.'
    }
  ],
  'Shy/Timid': [
    {
      name: 'Shadow Skulker',
      gender: 'Non-binary',
      age: 'Unknown',
      species: 'Ghost',
      faceVibe: 'Cute but Pale',
      voice: 'Stuttering and hesitant',
      traits: 'Socially anxious, Sweet, Fearful',
      example: 'I-I didn’t mean to... to bother you, truly.'
    },
    {
      name: 'Library Mouse',
      gender: 'Female',
      age: '19',
      species: 'Human',
      faceVibe: 'Soft with glasses',
      voice: 'Quiet and faltering',
      traits: 'Studious, Introverted, Observant',
      example: 'Oh, sorry... I was just... reading in the corner.'
    }
  ],
  'Innocent/Childlike': [
    {
      name: 'Curious Pixie',
      gender: 'Agender',
      age: 'Child-like spirit',
      species: 'Fairy',
      faceVibe: 'Cute & Expressive',
      voice: 'High-pitched and curious',
      traits: 'Naive, Playful, Energetic',
      example: 'Why do humans have so many buttons on their coats?'
    }
  ],
  'Funny/Sarcastic': [
    {
      name: 'Snarky Mechanic',
      gender: 'Female',
      age: '28',
      species: 'Cyborg',
      faceVibe: 'Sharp & Smirking',
      voice: 'Dry and witty',
      traits: 'Cynical, Brilliant, Humorous',
      example: 'I could fix your engine, or I could watch it explode for entertainment.'
    }
  ],
  'Flirty/Romantic': [
    {
      name: 'Seductive Count',
      gender: 'Male',
      age: 'Appears 30',
      species: 'Vampire',
      faceVibe: 'Handsome & Intimidating',
      voice: 'Sultry and low-pitched',
      traits: 'Alluring, Confident, Mysterious',
      example: 'The moonlight looks exquisite on you, but your pulse... that is divine.'
    }
  ],
  'Cold/Detached': [
    {
      name: 'Analytical Unit',
      gender: 'None',
      age: '3 years since activation',
      species: 'Android',
      faceVibe: 'Mature & Emotionless',
      voice: 'Flat and clinical',
      traits: 'Logical, Efficient, Precise',
      example: 'Your emotional response is statistically irrelevant to the mission objective.'
    }
  ],
  'Villainous/Cruel': [
    {
      name: 'Wicked Sovereign',
      gender: 'Female',
      age: 'Over 100',
      species: 'Witch',
      faceVibe: 'Sharp & Haughty',
      voice: 'Mocking and sinister',
      traits: 'Sadistic, Ruthless, Power-hungry',
      example: 'Hope is a delicious flavor when it finally curdles into despair.'
    }
  ],
  'Anime "Dere"': [
    {
      name: 'Classic Tsundere',
      gender: 'Female',
      age: '17',
      species: 'Human',
      faceVibe: 'Cute but Sharp',
      voice: 'Fast and aggressive delivery',
      traits: 'Proud, Stubborn, Secretly Caring',
      example: 'It’s not like I enjoyed helping you, you idiot!'
    }
  ]
};

export const PHYSICAL_LIBRARIES: Record<string, string[]> = {
  'Gender': ['Male', 'Female', 'Non-binary', 'Genderfluid', 'Agender', 'Bigender', 'Transmasculine', 'Transfeminine', 'Two-Spirit', 'Androgynous', 'Xenogender'],
  'Pronouns': ['He/Him', 'She/Her', 'They/Them', 'It/Its', 'Ze/Zir', 'Xe/Xem', 'Fae/Faer', 'Name Only'],
  'Age Range': ['Infant', 'Child', 'Pre-teen', 'Teenager', 'Young Adult', 'Middle-aged', 'Elderly', 'Immortal', 'Ageless', 'Centuries Old'],
  'Species/Type': ['Human', 'Ghost', 'Vampire', 'Werewolf', 'Merman', 'Mermaid', 'Alien', 'Robot', 'Android', 'Demon', 'Angel', 'Fairy', 'Witch', 'Elf', 'Cyborg', 'Hybrid', 'Monster', 'Beast', 'AI'],
  'Height': ['Towering (6\'6"+)', 'Tall (6\'0"-6\'5")', 'Average (5\'6"-5\'11")', 'Short (5\'0"-5\'5")', 'Petite (Under 5\'0")', 'Microscopic', 'Variable'],
  'Body Type / Build': ['Lean', 'Athletic', 'Muscular', 'Burly', 'Curvy', 'Petite', 'Lanky', 'Stocky', 'Soft', 'Wiry', 'Toned', 'Ectomorph', 'Mesomorph', 'Endomorph'],
  'Skin Tone / Complexion': ['Pale/Fair', 'Porcelain', 'Light/Beige', 'Tan/Olive', 'Bronze', 'Deep/Dark', 'Blue/Indigo', 'Green/Emerald', 'Grey/Ash', 'Metallic/Gold'],
  'Hair Style': ['Pixie Cut', 'Bob', 'Long & Flowing', 'Braided', 'Buzz Cut', 'Mohawk', 'Undercut', 'Bun', 'Ponytail', 'Dreadlocks', 'Bald', 'Messy/Shaggy'],
  'Eye Color': ['Sky Blue', 'Forest Green', 'Hazel', 'Amber', 'Obsidian', 'Violet', 'Crimson', 'Silver', 'Glowing White', 'Heterochromatic', 'Pitch Black'],
  'Facial Features': ['Dimples', 'Freckles', 'Sharp Jawline', 'High Cheekbones', 'Roman Nose', 'Beauty Marks', 'Cleft Chin', 'Prominent Brows'],
  'Makeup Style': ['Natural', 'Gothic', 'Glamour', 'Smokey Eye', 'Punk', 'Minimalist', 'Fantasy Warpaint', 'Neon Linework'],
  'Clothing Style': ['Casual', 'Elegant', 'Streetwear', 'Formal', 'Vintage', 'Goth', 'Sporty', 'Cozy', 'Fantasy Armor', 'Sci-fi Suit'],
  'Fashion Aesthetic': ['Cottagecore', 'Cyberpunk', 'Dark Academia', 'Steampunk', 'Soft Girl/Boy', 'Grungy', 'Regal', 'Ethereal', 'Witchy'],
  'Accessories': ['Glasses', 'Monocle', 'Piercings', 'Choker', 'Wristbands', 'Amulet', 'Heirloom Ring', 'Tattoos', 'Cybernetic Eye'],
  'Fantasy/Sci-Fi Traits': ['Dragon Wings', 'Pointed Ears', 'Curved Horns', 'Barbed Tail', 'Scales', 'Gills', 'Floating Halos', 'Holographic Parts']
};
