export function mapMuscleGroup(bodyParts: string[] = [], targets: string[] = []) {
  const t = (targets[0] || '').toLowerCase();
  if (t.includes('bicep')) return 'Biceps';
  if (t.includes('tricep')) return 'Triceps';
  if (t.includes('glute')) return 'Glutes';
  if (t.includes('trap')) return 'Traps';
  if (t.includes('pector') || t.includes('chest')) return 'Chest';
  if (t.includes('abs') || t.includes('oblique')) return 'Core';
  if (t.includes('quad') || t.includes('hamstring')) return 'Legs';
  if (t.includes('calf')) return 'Calves';
  if (t.includes('delt') || t.includes('shoulder')) return 'Shoulders';
  if (t.includes('lat') || t.includes('spine') || t.includes('back')) return 'Back';
  const b = (bodyParts[0] || '').toLowerCase();
  if (b.includes('chest')) return 'Chest';
  if (b.includes('back')) return 'Back';
  if (b.includes('shoulder')) return 'Shoulders';
  if (b.includes('upper arm')) return t.includes('tricep') ? 'Triceps' : 'Biceps';
  if (b.includes('upper leg') || b.includes('thigh')) return 'Legs';
  if (b.includes('lower leg') || b.includes('calf')) return 'Calves';
  if (b.includes('waist') || b.includes('core')) return 'Core';
  if (b.includes('glute')) return 'Glutes';
  return 'Other';
}

export function joinInstructions(steps: string[] = []) {
  return steps.map((s) => s.replace(/^Step:\d+\s*/i, '').trim()).filter(Boolean).join('\n');
}
