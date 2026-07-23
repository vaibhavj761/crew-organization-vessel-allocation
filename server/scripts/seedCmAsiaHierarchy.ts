import { PrismaClient, type WorkflowRole } from '@prisma/client'

const prisma = new PrismaClient()

type PersonSeed = {
  id: string
  name: string
  designation: string
  role: WorkflowRole
  notes?: string
}

const organization = {
  id: 'org_cm_asia',
  name: 'CM Asia',
  title: 'CM Asia – 150 vessels',
  footerText: 'Internal management presentation • Max Capacity – 165',
}

const crewDirector: PersonSeed = {
  id: 'person_amit_kumar',
  name: 'Amit Kumar',
  designation: 'Crew Director, Asia',
  role: 'CREW_DIRECTOR',
}

const operationsManagers = [
  {
    id: 'ops_reynald_castro',
    person: { id: 'person_reynald_castro', name: 'Reynald Castro', designation: 'Sr. Crw Ops Mgr, MNL', role: 'OPERATIONS_MANAGER' as const, notes: '70 VSLS' },
    deputies: [
      {
        id: 'deputy_hazzel_galao',
        person: { id: 'person_hazzel_galao', name: 'Hazzel Galao', designation: 'Crew Ops Manager', role: 'DEPUTY_MANAGER' as const, notes: '25' },
        crewManagers: [
          { id: 'cm_annavel_aviso', person: { id: 'person_annavel_aviso', name: 'Annavel Aviso', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '9' } },
          { id: 'cm_jake_parallag', person: { id: 'person_jake_parallag', name: 'Jake Parallag', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '10' } },
          { id: 'cm_john_e_nepomuceno', person: { id: 'person_john_e_nepomuceno', name: 'John E Nepomuceno', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '3' } },
          { id: 'cm_benju_bondoc', person: { id: 'person_benju_bondoc', name: 'Benju Bondoc', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '3' } },
        ],
      },
      {
        id: 'deputy_michael_salazer',
        person: { id: 'person_michael_salazer', name: 'Michael Salazer', designation: 'Crew Ops Manager', role: 'DEPUTY_MANAGER' as const, notes: '45' },
        crewManagers: [
          { id: 'cm_robee_ann_chua', person: { id: 'person_robee_ann_chua', name: 'Robee-Ann Chua', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '12' } },
          { id: 'cm_judith_ann_calimutan', person: { id: 'person_judith_ann_calimutan', name: 'Judith Ann Calimutan', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '10' } },
          { id: 'cm_angelee_agravante', person: { id: 'person_angelee_agravante', name: 'Angelee Agravante', designation: 'Crew Manager', role: 'CREW_MANAGER' as const } },
          { id: 'cm_mark_reiner_lao_ay', person: { id: 'person_mark_reiner_lao_ay', name: 'Mark Reiner Lao-ay', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '7' } },
          { id: 'cm_rodchan_vinas', person: { id: 'person_rodchan_vinas', name: 'Rodchan Viñas', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '8' } },
          { id: 'cm_tba_michael', person: { id: 'person_tba_michael', name: 'TBA / Michael', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '8' } },
        ],
      },
    ],
  },
  {
    id: 'ops_sidharth_bajaj',
    person: { id: 'person_sidharth_bajaj', name: 'Sidharth Bajaj', designation: 'GM, Mumbai', role: 'OPERATIONS_MANAGER' as const, notes: '65 VSLS' },
    deputies: [
      {
        id: 'deputy_pawan_kesari',
        person: { id: 'person_pawan_kesari', name: 'Pawan Kesari', designation: 'Deputy Manager', role: 'DEPUTY_MANAGER' as const, notes: '26' },
        crewManagers: [
          { id: 'cm_shalaka', person: { id: 'person_shalaka', name: 'Shalaka', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '10' } },
          { id: 'cm_cecilia_maniekar', person: { id: 'person_cecilia_maniekar', name: 'Cecilia Maniekar', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '6' } },
          { id: 'cm_jinal_kotak', person: { id: 'person_jinal_kotak', name: 'Jinal Kotak', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '10' } },
        ],
      },
      {
        id: 'deputy_namrata_joshi',
        person: { id: 'person_namrata_joshi', name: 'Namrata Joshi', designation: 'Crew Ops Manager', role: 'DEPUTY_MANAGER' as const, notes: '39' },
        crewManagers: [
          { id: 'cm_priyanka_vilkar', person: { id: 'person_priyanka_vilkar', name: 'Priyanka Vilkar', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '5' } },
          { id: 'cm_akshatha_moily', person: { id: 'person_akshatha_moily', name: 'Akshatha Moily', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '10' } },
          { id: 'cm_sneha_tak', person: { id: 'person_sneha_tak', name: 'Sneha Tak', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '11' } },
          { id: 'cm_chetan_bhandari', person: { id: 'person_chetan_bhandari', name: 'Chetan Bhandari', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '8' } },
          { id: 'cm_anushree_dandekar', person: { id: 'person_anushree_dandekar', name: 'Anushree Dandekar', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '5' } },
        ],
      },
    ],
  },
  {
    id: 'ops_abhijeet_k',
    person: { id: 'person_abhijeet_k', name: 'Abhijeet K.', designation: 'GM, Chennai', role: 'OPERATIONS_MANAGER' as const, notes: '22 VSLS' },
    deputies: [
      {
        id: 'deputy_balaji',
        person: { id: 'person_balaji', name: 'Balaji', designation: 'Crew Ops Manager', role: 'DEPUTY_MANAGER' as const, notes: '22' },
        crewManagers: [
          { id: 'cm_priyanka_karthik', person: { id: 'person_priyanka_karthik', name: 'Priyanka Karthik', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '8' } },
          { id: 'cm_smitha', person: { id: 'person_smitha', name: 'Smitha', designation: 'Crew Manager', role: 'CREW_MANAGER' as const, notes: '9' } },
          { id: 'cm_tba_container', person: { id: 'person_tba_container', name: 'TBA / Container', designation: 'Crew Manager', role: 'CREW_MANAGER' as const } },
        ],
      },
    ],
  },
]

const vesselAssignments: Record<string, string[]> = {
  cm_annavel_aviso: [
    'BLUE NEPTUNE',
    'SCARLET CYPRESS',
    'ETERNITY DIVA',
    'HOUHENG 5',
    'HOUHENG 6',
    'TRANSCENDEN AG',
    'TRANSCENDEN CRYSTAL',
    'TRANSCENDEN EMERALD',
    'TRANSCENDEN FORTUNE',
  ],
  cm_jake_parallag: [
    'HORDA',
    'WESTERN EGDA',
    'AFRICAN SHRIKE',
    'AFRICAN PLOVER',
    'AFRICAN ROLLER',
    'TRUE PATRIOT',
    'TRUE CRUSADER',
    'PEAK HAKU',
    'PEAK MATTERHORN',
    'PEAK RANIER',
  ],
  cm_john_e_nepomuceno: ['CHAMBERTIN', 'MUSIGNY', 'RICHEBOURG'],
  cm_benju_bondoc: ['STELLA ALICE', 'STELLA TESS', 'TAHAROA EOS'],
  cm_judith_ann_calimutan: [
    'XH DREAM',
    'XH EXPLORER',
    'XH HOPE',
    'XH META',
    'XH NINGBO',
    'XH ALOT',
    'XH ATOP',
    'SHANDONG FU ZHI',
    'SHANDONG FU DE',
    'SHANDONG FU YOU',
  ],
  cm_robee_ann_chua: [
    'XH DEEP COVER',
    'XH MEGA',
    'XH SANMEN BAY',
    'XH SQUARE LEG',
    'XH SUNSHINE',
    'XH TAIZHOU',
    'XH VOYAGER',
    'XH VALOR',
    'XH NAVIGATOR',
    'XH MARINER',
    'XH BLOSSOM',
  ],
  cm_rodchan_vinas: [
    'VIKING EMERALD',
    'VIKING SEA',
    'VIKING BRAVERY',
    'VIKING DESTINY',
    'VIKING DRIVE',
    'VIKING QUEEN',
    'VIKING BRASILIA',
    'VIKING SYDNEY',
  ],
  cm_tba_michael: [
    'ANJI FLOURISHMENT',
    'ANJI FORTUNE',
    'ANJI LUCK',
    'POLARIS LIBERTY',
    'POLARIS MILA',
    'POLARIS PRINCESS',
    'POLARIS OSLO',
    'POLARIS STAR',
  ],
  cm_mark_reiner_lao_ay: [
    'VIKING ADVENTURE',
    'VIKING CORAL',
    'VIKING DIAMOND',
    'VIKING OCEAN',
    'MED. HIGHWAY',
    'ASTURIAS',
    'MINCHAH',
  ],
  cm_cecilia_maniekar: [
    'SILVER LINDA',
    'SILVER ZOE',
    'SILVER HOUSTON',
    'EVER VIGOROUS',
    'LUOJAOSHAN',
    'CAND FORTUNE',
  ],
  cm_shalaka: [
    'ARDBEG',
    'DICTADOR',
    'AULTMORE',
    'AUCHENTOSHAN',
    'DALMORE',
    'BALVENIE',
    'BUNNAHABHAIN',
    'CLYNELISH',
    'ELFAIVE',
    'CRAGGANMORE',
  ],
  cm_jinal_kotak: [
    'XT FORTUNE',
    'XT HOPE',
    'XT HONESTY',
    'XT PROGRESS',
    'XT PROSPERITY',
    'CC NINGBO',
    'CC QINGDAO',
    'CC YANTAI',
    'SOUTHERN WOLF',
    'CHEMGUARD',
  ],
  cm_priyanka_vilkar: ['HYGGE', 'LAGOM', 'TROUVAILLE', 'REDAMANCY', 'ARREBOL'],
  cm_akshatha_moily: [
    'AQUA 1',
    'YUFU CROWN',
    'YACA',
    'CURURO',
    'PS IMABARI',
    'PS NEW ORLEANS',
    'PS TOKYO',
    'AUGENSTERN',
    'KOMOREBI',
    'MURMURE',
  ],
  cm_chetan_bhandari: [
    'MARIANA GLORY',
    'GAS CAMELOT',
    'GAS QUILA',
    'GAS SOPHIA',
    'GAS ROYALE',
    'GAS SUASA',
    'TITAN UNIKUM',
    'TITAN VISION',
  ],
  cm_sneha_tak: [
    'HP3',
    'CRUZ',
    'ALEJANDRO',
    'AEROSEA CATALINA',
    'SCARLET MELINDA',
    'TIANO',
    'BLUEBIRD',
    'STARLING',
    'MARGARETA',
    'OMERA GALAXY',
    'OMERA LEGACY',
  ],
  cm_anushree_dandekar: ['DPW CHENNAI', 'DPW INDUS', 'SS GODAVARI', 'SS THAMIRABARANI', 'SS KAVERI'],
  cm_smitha: [
    'SFL LION',
    'SFL PUMA',
    'SFL TIGER',
    'SFL TRINITY',
    'SFL SABINE',
    'FRONT OCELOT',
    'FRONT LYNX',
    'FRONT LEOPARD',
    'FRONT JAGUAR',
  ],
  cm_priyanka_karthik: [
    'FRONT DUKE',
    'FRONT DUCHESS',
    'FRONT DEFENDER',
    'FRONT DISCOVERY',
    'FRONT DYNAMIC',
    'FRONT CRUISER',
    'SFL TRINITY',
    'SFL SABINE',
  ],
}

function idPart(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 48)
}

async function createPerson(data: PersonSeed) {
  return prisma.person.create({
    data: {
      id: data.id,
      organizationId: organization.id,
      name: data.name,
      designation: data.designation,
      workflowRole: data.role,
      notes: data.notes || null,
    },
  })
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.vesselAllocation.deleteMany()
    await tx.assistant.deleteMany()
    await tx.vessel.deleteMany()
    await tx.crewManager.deleteMany()
    await tx.deputyManager.deleteMany()
    await tx.operationsManager.deleteMany()
    await tx.crewDirector.deleteMany()
    await tx.person.deleteMany()
    await tx.organization.deleteMany()
  })

  await prisma.organization.create({
    data: {
      id: organization.id,
      name: organization.name,
      title: organization.title,
      footerText: organization.footerText,
      effectiveDate: new Date(),
    },
  })

  await createPerson(crewDirector)
  await prisma.crewDirector.create({
    data: {
      id: 'crew_director_amit_kumar',
      organizationId: organization.id,
      personId: crewDirector.id,
      sortOrder: 1,
    },
  })

  for (const [opIndex, op] of operationsManagers.entries()) {
    await createPerson(op.person)
    await prisma.operationsManager.create({
      data: {
        id: op.id,
        organizationId: organization.id,
        crewDirectorId: 'crew_director_amit_kumar',
        personId: op.person.id,
        sortOrder: opIndex + 1,
      },
    })

    for (const [deputyIndex, deputy] of op.deputies.entries()) {
      await createPerson(deputy.person)
      await prisma.deputyManager.create({
        data: {
          id: deputy.id,
          organizationId: organization.id,
          operationsManagerId: op.id,
          personId: deputy.person.id,
          sortOrder: deputyIndex + 1,
        },
      })

      for (const [cmIndex, crewManager] of deputy.crewManagers.entries()) {
        await createPerson(crewManager.person)
        await prisma.crewManager.create({
          data: {
            id: crewManager.id,
            organizationId: organization.id,
            deputyManagerId: deputy.id,
            personId: crewManager.person.id,
            sortOrder: cmIndex + 1,
          },
        })
      }
    }
  }

  let vesselSortOrder = 1
  for (const [crewManagerId, vessels] of Object.entries(vesselAssignments)) {
    const crewManager = await prisma.crewManager.findUniqueOrThrow({
      where: { id: crewManagerId },
      include: { deputyManager: { include: { operationsManager: true } } },
    })
    const operationsManager = crewManager.deputyManager.operationsManager
    const operationsLine = await prisma.operationsManagerReportingLine.upsert({
      where: {
        operationsManagerId_crewDirectorId: {
          operationsManagerId: operationsManager.id,
          crewDirectorId: operationsManager.crewDirectorId,
        },
      },
      create: {
        organizationId: organization.id,
        operationsManagerId: operationsManager.id,
        crewDirectorId: operationsManager.crewDirectorId,
        isPrimary: true,
      },
      update: {},
    })
    const deputyLine = await prisma.deputyManagerReportingLine.upsert({
      where: {
        deputyManagerId_operationsManagerReportingLineId: {
          deputyManagerId: crewManager.deputyManager.id,
          operationsManagerReportingLineId: operationsLine.id,
        },
      },
      create: {
        organizationId: organization.id,
        deputyManagerId: crewManager.deputyManager.id,
        operationsManagerId: operationsManager.id,
        operationsManagerReportingLineId: operationsLine.id,
        isPrimary: true,
      },
      update: {},
    })
    const crewLine = await prisma.crewManagerReportingLine.upsert({
      where: {
        crewManagerId_deputyManagerReportingLineId: {
          crewManagerId,
          deputyManagerReportingLineId: deputyLine.id,
        },
      },
      create: {
        organizationId: organization.id,
        crewManagerId,
        deputyManagerId: crewManager.deputyManager.id,
        deputyManagerReportingLineId: deputyLine.id,
        isPrimary: true,
      },
      update: {},
    })
    for (const [vesselIndex, vesselName] of vessels.entries()) {
      const vessel = await prisma.vessel.create({
        data: {
          id: `vessel_${idPart(crewManagerId)}_${String(vesselIndex + 1).padStart(2, '0')}_${idPart(vesselName)}`,
          organizationId: organization.id,
          name: vesselName,
          vesselType: null,
          vesselStatus: 'UPCOMING',
          managementType: 'FULL_MANAGED',
          notes: 'Imported from reference screenshot. Vessel details pending.',
          sortOrder: vesselSortOrder,
        },
      })
      await prisma.vesselAllocation.create({
        data: {
          vesselId: vessel.id,
          crewManagerId,
          crewManagerReportingLineId: crewLine.id,
        },
      })
      vesselSortOrder += 1
    }
  }

  const vesselCount = Object.values(vesselAssignments).reduce((total, vessels) => total + vessels.length, 0)
  console.log(`CM Asia hierarchy seeded with ${vesselCount} visible vessel assignments. Users and authentication data were not changed.`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
