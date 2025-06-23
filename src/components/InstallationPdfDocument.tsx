import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
  Circle,
} from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    paddingBottom: 70,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1pt solid #000000',
    paddingBottom: 10,
  },
  logo: {
    width: 150,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  title: {
    fontSize: 20,
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 20,
    backgroundColor: '#1e40af',
    color: 'white',
    padding: 12,
    borderRadius: 6,
    textAlign: 'center',
  },
  installationSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 15,
    borderRadius: 8,
    textAlign: 'center',
    borderLeft: '4pt solid #3b82f6',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  column: {
    flexDirection: 'column',
    marginBottom: 15,
    gap: 8,
  },
  label: {
    width: '30%',
    fontSize: 12,
    fontWeight: 'bold',
  },
  value: {
    width: '70%',
    fontSize: 12,
  },
  checklistRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    alignItems: 'center',
    borderLeft: '3pt solid #e2e8f0',
  },
  checklistRowInstalled: {
    backgroundColor: '#f0fdf4',
    borderLeft: '3pt solid #22c55e',
  },
  checklistRowMissing: {
    backgroundColor: '#fef2f2',
    borderLeft: '3pt solid #ef4444',
  },
  checklistItem: {
    fontSize: 12,
    marginLeft: 12,
    flex: 1,
  },
  checklistItemName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  checklistItemStatus: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#64748b',
  },
  statusIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
  },
  checkMark: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  crossMark: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 10,
    textAlign: 'center',
    borderTop: '1pt solid #000000',
    paddingTop: 10,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    fontSize: 10,
  },
  signature: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    height: 100,
    border: '1pt solid #000000',
    padding: 10,
  },
  signatureLabel: {
    fontSize: 10,
    marginBottom: 70,
  },
  signatureImage: {
    width: '100%',
    height: 80,
    objectFit: 'contain',
    marginTop: 5,
  },
  signatureDate: {
    fontSize: 10,
    marginTop: 5,
    fontStyle: 'italic',
  },
  noteText: {
    fontSize: 12,
    marginTop: 10,
    marginBottom: 10,
    lineHeight: 1.5,
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    border: '1pt solid #e2e8f0',
    borderRadius: 5,
    padding: 15,
    marginBottom: 15,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e40af',
  },
  infoText: {
    fontSize: 11,
    lineHeight: 1.4,
    marginBottom: 8,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    border: '1pt solid #f59e0b',
    borderRadius: 5,
    padding: 15,
    marginBottom: 15,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#d97706',
  },
  paymentBox: {
    backgroundColor: '#fef2f2',
    border: '1pt solid #dc2626',
    borderRadius: 5,
    padding: 15,
    marginBottom: 15,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#dc2626',
    textAlign: 'center',
  },
  paymentText: {
    fontSize: 12,
    lineHeight: 1.4,
    marginBottom: 8,
    textAlign: 'center',
  },
});

// Format date to display in French format
const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
};

// Format date with time to display in French format
const formatDateWithTime = (date: string | null | undefined): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Define constants for pricing
const ANTENNA_SUPPORT_PRICE = 50;
const PLACEMENT_PRICE = 200;
const WIRE_PRICE_PER_METER = 1.3;

// SVG Icon Components
const CheckIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path
      d="M20 6L9 17l-5-5"
      stroke="#22c55e"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const XIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path
      d="M18 6L6 18M6 6l12 12"
      stroke="#ef4444"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const RobotIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path
      d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v1a3 3 0 0 1-3 3h-1v1a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1H6a3 3 0 0 1-3-3v-1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2Z"
      fill="#3b82f6"
    />
    <Circle cx="9" cy="12" r="1" fill="white" />
    <Circle cx="15" cy="12" r="1" fill="white" />
  </Svg>
);

const PlugIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path
      d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3Z"
      fill="#8b5cf6"
    />
    <Path
      d="M8 11v4a4 4 0 0 0 8 0v-4"
      stroke="#8b5cf6"
      strokeWidth="2"
      fill="none"
    />
    <Path d="M12 19v4" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const AntennaIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path
      d="M2 12h4l3-9 3 9 3-6 3 6h4"
      stroke="#f59e0b"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ShelterIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path d="M3 21h18" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
    <Path
      d="M5 21V7l8-4v18"
      stroke="#10b981"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M19 21V11l-6-4"
      stroke="#10b981"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const WireIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path d="M3 12h18" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
    <Path
      d="M8 8l-4 4 4 4"
      stroke="#6366f1"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M16 8l4 4-4 4"
      stroke="#6366f1"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SupportIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path d="M12 2v6" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
    <Path
      d="M12 8l-3 14h6l-3-14Z"
      stroke="#dc2626"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const PlacementIcon = () => (
  <Svg style={styles.statusIcon} viewBox="0 0 24 24">
    <Path
      d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Z"
      stroke="#f97316"
      strokeWidth="2"
      fill="none"
    />
    <Circle cx="12" cy="9" r="3" stroke="#f97316" strokeWidth="2" fill="none" />
  </Svg>
);

interface PurchaseOrder {
  id: number;
  clientFirstName: string;
  clientLastName: string;
  clientAddress: string;
  clientCity: string;
  clientPhone: string;
  clientEmail: string;
  deposit: number;
  installationDate: string | null;
  installationNotes: string | null;
  installerName: string | null;
  installationCompletedAt: string | null;
  robotInstalled: boolean;
  pluginInstalled: boolean;
  antennaInstalled: boolean;
  shelterInstalled: boolean;
  wireInstalled: boolean;
  antennaSupportInstalled: boolean;
  placementCompleted: boolean;
  missingItems: string | null;
  additionalComments: string | null;
  clientSignature: string | null;
  hasWire: boolean;
  wireLength: number | null;
  hasAntennaSupport: boolean;
  hasPlacement: boolean;
  robotInventory: {
    name: string;
    sellingPrice: number;
  };
  plugin?: {
    name: string;
    sellingPrice: number;
  } | null;
  antenna?: {
    name: string;
    sellingPrice: number;
  } | null;
  shelter?: {
    name: string;
    sellingPrice: number;
  } | null;
}

// Function to render page footer with page number
const PageFooter = () => (
  <View fixed style={styles.footer}>
    <Text style={{ fontSize: 9, marginBottom: 5 }}>
      FORESTAR - Bon d'installation généré le{' '}
      {new Date().toLocaleDateString('fr-FR')}
    </Text>
  </View>
);

// Document component for the Installation PDF
export const InstallationPdfDocument: React.FC<{
  purchaseOrder: PurchaseOrder;
}> = ({ purchaseOrder }) => {
  // Calculate remaining balance
  const calculateRemainingBalance = () => {
    let total = purchaseOrder.robotInventory?.sellingPrice || 0;

    if (purchaseOrder.plugin?.sellingPrice) {
      total += purchaseOrder.plugin.sellingPrice;
    }

    if (purchaseOrder.antenna?.sellingPrice) {
      total += purchaseOrder.antenna.sellingPrice;
    }

    if (purchaseOrder.shelter?.sellingPrice) {
      total += purchaseOrder.shelter.sellingPrice;
    }

    if (purchaseOrder.hasAntennaSupport) {
      total += ANTENNA_SUPPORT_PRICE;
    }

    if (purchaseOrder.hasPlacement) {
      total += PLACEMENT_PRICE;
    }

    // Add wire price if applicable
    if (purchaseOrder.hasWire && purchaseOrder.wireLength) {
      total += WIRE_PRICE_PER_METER * purchaseOrder.wireLength;
    }

    return total - purchaseOrder.deposit;
  };

  const getItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'robot':
        return <RobotIcon />;
      case 'plugin':
        return <PlugIcon />;
      case 'antenna':
        return <AntennaIcon />;
      case 'shelter':
        return <ShelterIcon />;
      case 'wire':
        return <WireIcon />;
      case 'support':
        return <SupportIcon />;
      case 'placement':
        return <PlacementIcon />;
      default:
        return null;
    }
  };

  const renderChecklistItem = (
    label: string,
    isInstalled: boolean,
    isRequired: boolean,
    itemType: string,
  ) => {
    const rowStyle = [
      styles.checklistRow,
      isInstalled ? styles.checklistRowInstalled : styles.checklistRowMissing,
    ];

    return (
      <View style={rowStyle}>
        {getItemIcon(itemType)}
        {isInstalled ? <CheckIcon /> : <XIcon />}
        <View style={styles.checklistItem}>
          <Text style={styles.checklistItemName}>{label}</Text>
          <Text style={styles.checklistItemStatus}>
            {isInstalled
              ? 'Installé avec succès'
              : isRequired
                ? 'MANQUANT - Installation requise'
                : 'Non installé (optionnel)'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Document>
      {/* Page 1: Installation Summary */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>FORESTAR</Text>
          <Text style={{ fontSize: 14, color: '#666666' }}>
            Bon d'installation
          </Text>
        </View>

        {/* Page number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />

        {/* Footer */}
        <PageFooter />

        {/* Title */}
        <Text style={styles.title}>
          BON D'INSTALLATION - Commande #{purchaseOrder.id}
        </Text>
        <View style={{ marginBottom: 15, fontSize: 11 }}>
          <Text style={{ fontSize: 11, marginBottom: 3 }}>
            Date d'installation: {formatDate(purchaseOrder.installationDate)}
          </Text>
          <Text style={{ fontSize: 11, marginBottom: 3 }}>
            Installation terminée le:{' '}
            {formatDateWithTime(purchaseOrder.installationCompletedAt)}
          </Text>
          <Text style={{ fontSize: 11 }}>
            Installateur: {purchaseOrder.installerName || '-'}
          </Text>
        </View>

        {/* Client Information */}
        <View style={styles.sectionTitle}>
          <Text>Informations Client</Text>
        </View>
        <View style={styles.column}>
          <View style={styles.row}>
            <Text style={styles.label}>Client:</Text>
            <Text style={styles.value}>
              {purchaseOrder.clientFirstName} {purchaseOrder.clientLastName}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Adresse:</Text>
            <Text style={styles.value}>
              {purchaseOrder.clientAddress}, {purchaseOrder.clientCity}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Téléphone:</Text>
            <Text style={styles.value}>{purchaseOrder.clientPhone}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{purchaseOrder.clientEmail}</Text>
          </View>
        </View>

        {/* Equipment Installation Status */}
        <View style={styles.installationSectionTitle}>
          <Text>État de l'installation</Text>
        </View>
        <View style={styles.column}>
          {renderChecklistItem(
            `[Robot] ${purchaseOrder.robotInventory.name}`,
            purchaseOrder.robotInstalled,
            true,
            'robot',
          )}

          {purchaseOrder.plugin &&
            renderChecklistItem(
              `[Plugin] ${purchaseOrder.plugin.name}`,
              purchaseOrder.pluginInstalled,
              true,
              'plugin',
            )}

          {purchaseOrder.antenna &&
            renderChecklistItem(
              `[Antenne] ${purchaseOrder.antenna.name}`,
              purchaseOrder.antennaInstalled,
              true,
              'antenna',
            )}

          {purchaseOrder.shelter &&
            renderChecklistItem(
              `[Abri] ${purchaseOrder.shelter.name}`,
              purchaseOrder.shelterInstalled,
              true,
              'shelter',
            )}

          {purchaseOrder.hasWire &&
            renderChecklistItem(
              `Fil périmétrique (${purchaseOrder.wireLength}m)`,
              purchaseOrder.wireInstalled,
              true,
              'wire',
            )}

          {purchaseOrder.hasAntennaSupport &&
            renderChecklistItem(
              "Support d'antenne",
              purchaseOrder.antennaSupportInstalled,
              true,
              'support',
            )}

          {purchaseOrder.hasPlacement &&
            renderChecklistItem(
              'Mise en place du robot',
              purchaseOrder.placementCompleted,
              true,
              'placement',
            )}
        </View>

        {/* Installation Notes */}
        {purchaseOrder.installationNotes && (
          <>
            <View style={styles.sectionTitle}>
              <Text>Notes d'installation</Text>
            </View>
            <Text style={styles.noteText}>
              {purchaseOrder.installationNotes}
            </Text>
          </>
        )}

        {/* Missing Items */}
        {purchaseOrder.missingItems && (
          <>
            <View style={styles.sectionTitle}>
              <Text>Éléments manquants</Text>
            </View>
            <Text style={[styles.noteText, { color: '#dc2626' }]}>
              {purchaseOrder.missingItems}
            </Text>
          </>
        )}

        {/* Additional Comments */}
        {purchaseOrder.additionalComments && (
          <>
            <View style={styles.sectionTitle}>
              <Text>Commentaires additionnels</Text>
            </View>
            <Text style={styles.noteText}>
              {purchaseOrder.additionalComments}
            </Text>
          </>
        )}
      </Page>

      {/* Page 2: User Guide and Payment Information */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>FORESTAR</Text>
          <Text style={{ fontSize: 14, color: '#666666' }}>
            Guide d'utilisation et paiement
          </Text>
        </View>

        <PageFooter />

        {/* Page number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />

        {/* User Guide */}
        <View style={styles.infoBox} break={false}>
          <Text style={styles.infoTitle}>
            Que faire si mon robot s'arrête ?
          </Text>

          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>
              1. Vérifications de base :
            </Text>
          </Text>
          <Text style={styles.infoText}>
            • Vérifiez que la station de charge est bien branchée
          </Text>
          <Text style={styles.infoText}>
            • Contrôlez le niveau de batterie du robot
          </Text>
          <Text style={styles.infoText}>
            • Assurez-vous qu'aucun obstacle ne bloque le robot
          </Text>

          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>2. Redémarrage :</Text>
          </Text>
          <Text style={styles.infoText}>
            • Appuyez sur le bouton STOP puis START sur le robot
          </Text>
          <Text style={styles.infoText}>
            • Si le problème persiste, éteignez et rallumez le robot
          </Text>

          <Text style={styles.infoText}>
            <Text style={{ fontWeight: 'bold' }}>
              3. Codes d'erreur courants :
            </Text>
          </Text>
          <Text style={styles.infoText}>
            • Erreur de roue : vérifiez qu'aucune herbe n'est coincée
          </Text>
          <Text style={styles.infoText}>
            • Erreur de fil : contrôlez la continuité du fil périmétrique
          </Text>
          <Text style={styles.infoText}>
            • Erreur de charge : nettoyez les contacts de charge
          </Text>
        </View>

        <View style={styles.warningBox} break={false}>
          <Text style={styles.warningTitle}>Maintenance recommandée</Text>
          <Text style={styles.infoText}>
            • Nettoyez régulièrement les lames et le dessous du robot
          </Text>
          <Text style={styles.infoText}>
            • Vérifiez l'état du fil périmétrique après les intempéries
          </Text>
          <Text style={styles.infoText}>
            • Effectuez un contrôle annuel de l'ensemble du système
          </Text>
          <Text style={styles.infoText}>
            • En cas de problème persistant, contactez notre service après-vente
          </Text>
        </View>

        {/* Contact Information */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Nous contacter</Text>
          <Text style={styles.infoText}>
            Service après-vente : 01 23 45 67 89
          </Text>
          <Text style={styles.infoText}>Email : support@forestar.fr</Text>
          <Text style={styles.infoText}>
            Disponible du lundi au vendredi de 9h à 18h
          </Text>
        </View>
      </Page>

      {/* Page 3: Payment and Signatures */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>FORESTAR</Text>
          <Text style={{ fontSize: 14, color: '#666666' }}>
            Règlement et signatures
          </Text>
        </View>

        <PageFooter />

        {/* Page number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />

        <Text style={styles.title}>RÈGLEMENT ET VALIDATION</Text>

        {/* Payment Information */}
        <View style={styles.paymentBox}>
          <Text style={styles.paymentTitle}>RÈGLEMENT DU SOLDE</Text>
          <Text style={styles.paymentText}>
            <Text style={{ fontWeight: 'bold' }}>
              Montant restant à régler :{' '}
              {calculateRemainingBalance().toFixed(2)} €
            </Text>
          </Text>
          <Text style={styles.paymentText}>
            (Montant total :{' '}
            {(calculateRemainingBalance() + purchaseOrder.deposit).toFixed(2)} €
            - Acompte versé : {purchaseOrder.deposit.toFixed(2)} €)
          </Text>
          <Text style={styles.paymentText}>
            Le règlement du solde peut être effectué :
          </Text>
          <Text style={styles.paymentText}>
            • Par chèque à l'ordre de FORESTAR
          </Text>
          <Text style={styles.paymentText}>
            • Par virement bancaire (RIB fourni séparément)
          </Text>
          <Text style={styles.paymentText}>
            • Par carte bancaire via notre site web
          </Text>
          <Text style={styles.paymentText}>
            <Text style={{ fontWeight: 'bold' }}>
              Merci de régler dans les 30 jours suivant l'installation.
            </Text>
          </Text>
        </View>

        <Text style={styles.title}>VALIDATION DE L'INSTALLATION</Text>

        <Text style={styles.noteText}>
          Je soussigné(e) {purchaseOrder.clientFirstName}{' '}
          {purchaseOrder.clientLastName}, certifie avoir reçu et accepté
          l'installation du matériel robotique conforme à la commande n°
          {purchaseOrder.id}.
        </Text>

        <Text style={styles.noteText}>
          L'installation a été réalisée le{' '}
          {formatDate(purchaseOrder.installationDate)} par{' '}
          {purchaseOrder.installerName}.
        </Text>

        {/* Client Signature */}
        <View style={styles.signature}>
          <View style={[styles.signatureBox, { width: '100%' }]}>
            <Text style={styles.signatureLabel}>Signature du client</Text>
            {purchaseOrder.clientSignature ? (
              <Image
                src={purchaseOrder.clientSignature}
                style={styles.signatureImage}
              />
            ) : null}
            <Text style={styles.signatureDate}>
              Date: {formatDate(purchaseOrder.installationCompletedAt)}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.noteText,
            { marginTop: 30, textAlign: 'center', fontSize: 10 },
          ]}
        >
          Ce document fait foi de la réalisation de l'installation. Un
          exemplaire est remis au client et un autre conservé par FORESTAR.
        </Text>
      </Page>
    </Document>
  );
};
