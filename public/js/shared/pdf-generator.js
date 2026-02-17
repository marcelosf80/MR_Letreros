/**
 * PDF Generator - Generador de Presupuestos en PDF
 * Sistema profesional para generar presupuestos en formato PDF
 * Usando jsPDF y autoTable
 * 
 * @version 1.0.0
 * @author MR Letreros Team
 */

class PDFGenerator {
    constructor() {
        this.doc = null;
        this.pageWidth = 210; // A4 width in mm
        this.pageHeight = 297; // A4 height in mm
        this.margin = 20;
        this.currentY = 20;
        
        // Colores corporativos
        this.colors = {
            primary: [99, 102, 241],      // #6366F1
            secondary: [139, 92, 246],    // #8B5CF6
            dark: [30, 30, 40],           // #1E1E28
            gray: [156, 163, 175],        // #9CA3AF
            success: [76, 175, 80],       // #4CAF50
            white: [255, 255, 255]
        };
    }

    /**
     * Genera presupuesto de Gremio en PDF
     * @param {Object} quoteData - Datos de la cotización
     * @returns {Blob} - PDF generado
     */
    async generateGremioQuote(quoteData) {
        // Importar jsPDF
        if (!window.jspdf) {
            await this.loadJsPDF();
        }

        const { jsPDF } = window.jspdf;
        this.doc = new jsPDF('p', 'mm', 'a4');
        this.currentY = 20;

        // Agregar contenido
        await this.addHeader();
        this.addClientInfo(quoteData);
        this.addProductsTable(quoteData);
        this.addTotals(quoteData);
        this.addFooter();
        
        return this.doc;
    }

    /**
     * Genera presupuesto de Clientes en PDF
     * @param {Object} quoteData - Datos de la cotización
     * @returns {Blob} - PDF generado
     */
    async generateClientesQuote(quoteData) {
        // Similar a gremio pero con formato diferente
        if (!window.jspdf) {
            await this.loadJsPDF();
        }

        const { jsPDF } = window.jspdf;
        this.doc = new jsPDF('p', 'mm', 'a4');
        this.currentY = 20;

        await this.addHeader();
        this.addClientInfo(quoteData, 'CLIENTES');
        this.addProductsTable(quoteData);
        this.addTotals(quoteData);
        this.addFooter();
        
        return this.doc;
    }

    /**
     * Agrega header con logo y datos de la empresa
     */
    async addHeader() {
        const doc = this.doc;
        
        // Rectángulo superior con gradiente (simulado con opacidad)
        doc.setFillColor(...this.colors.primary);
        doc.rect(0, 0, this.pageWidth, 50, 'F');
        
        // Logo (si está disponible)
        try {
            const logoImg = await this.loadImage('/img/logo.png');
            doc.addImage(logoImg, 'PNG', 15, 10, 40, 15);
        } catch (e) {
            console.warn('Logo no disponible');
        }

        // Título de la empresa
        doc.setTextColor(...this.colors.white);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('SERVICIOS GRÁFICOS INTEGRALES', this.pageWidth - 15, 20, { align: 'right' });
        
        // Información de contacto
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('J.P.Lopez 3162', this.pageWidth - 15, 27, { align: 'right' });
        doc.text('📞 3426136868', this.pageWidth - 15, 32, { align: 'right' });
        doc.text('📱 @mrletreros', this.pageWidth - 15, 37, { align: 'right' });

        this.currentY = 60;
    }

    /**
     * Agrega información del cliente
     * @param {Object} quoteData
     * @param {string} type - 'GREMIO' o 'CLIENTES'
     */
    addClientInfo(quoteData, type = 'GREMIO') {
        const doc = this.doc;
        
        // Título del presupuesto
        doc.setFillColor(...this.colors.dark);
        doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 12, 'F');
        
        doc.setTextColor(...this.colors.white);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`PRESUPUESTO ${type}`, this.margin + 5, this.currentY + 8);
        
        this.currentY += 18;

        // Datos del cliente
        doc.setFillColor(245, 245, 247);
        doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 35, 'F');
        
        doc.setTextColor(...this.colors.dark);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL CLIENTE', this.margin + 5, this.currentY + 7);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const clientName = quoteData.cliente?.nombre || quoteData.clientName || 'Sin especificar';
        const clientPhone = quoteData.cliente?.telefono || quoteData.clientPhone || 'Sin especificar';
        const clientEmail = quoteData.cliente?.email || quoteData.clientEmail || '';
        const fecha = this.formatDate(quoteData.fecha || new Date().toISOString());
        
        doc.text(`Cliente: ${clientName}`, this.margin + 5, this.currentY + 15);
        doc.text(`Contacto: ${clientPhone}`, this.margin + 5, this.currentY + 21);
        if (clientEmail) {
            doc.text(`Email: ${clientEmail}`, this.margin + 5, this.currentY + 27);
        }
        doc.text(`Fecha: ${fecha}`, this.pageWidth - this.margin - 5, this.currentY + 15, { align: 'right' });
        
        this.currentY += 45;
    }

    /**
     * Agrega tabla de productos
     * @param {Object} quoteData
     */
    addProductsTable(quoteData) {
        const doc = this.doc;
        
        // Título
        doc.setTextColor(...this.colors.dark);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE DE PRODUCTOS', this.margin, this.currentY);
        
        this.currentY += 8;

        // Preparar datos de productos
        const productos = quoteData.productos || [];
        const terceros = quoteData.terceros || [];
        const multiCategories = quoteData.multiCategories;
        
        let tableData = [];
        let totalSuperficie = 0;
        let itemNumber = 1;

        // Productos normales
        productos.forEach(prod => {
            const cantidad = parseFloat(prod.quantity) || 0;
            totalSuperficie += cantidad;
            
            const descripcion = [
                prod.productName || 'Producto',
                `Medidas: ${prod.width || 0}cm x ${prod.height || 0}cm (${cantidad.toFixed(2)}m²)`,
                `Cantidad: ${prod.cantidad || 1}`
            ].join('\n');
            
            tableData.push([
                itemNumber++,
                descripcion,
                `$ ${this.formatCurrency(prod.total || 0)}`
            ]);
        });

        // Categorías múltiples
        if (multiCategories && multiCategories.categories) {
            multiCategories.categories.forEach(cat => {
                const m2 = multiCategories.sharedDimensions?.totalM2 || 0;
                totalSuperficie += m2;
                
                const descripcion = [
                    cat.name,
                    `Medidas: ${multiCategories.sharedDimensions?.width || 0}m x ${multiCategories.sharedDimensions?.height || 0}m (${m2.toFixed(2)}m²)`,
                    `Precio/m²: $${this.formatCurrency(cat.pricePerM2)}`
                ].join('\n');
                
                tableData.push([
                    itemNumber++,
                    descripcion,
                    `$ ${this.formatCurrency(cat.totalPrice || 0)}`
                ]);
            });
        }

        // Servicios de terceros
        terceros.forEach(terc => {
            const descripcion = [
                terc.serviceName || 'Servicio',
                terc.description || ''
            ].filter(Boolean).join('\n');
            
            tableData.push([
                itemNumber++,
                descripcion,
                `$ ${this.formatCurrency(terc.total || 0)}`
            ]);
        });

        // Dibujar tabla
        if (tableData.length > 0) {
            doc.autoTable({
                startY: this.currentY,
                head: [['#', 'Descripción', 'Precio']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: this.colors.primary,
                    textColor: this.colors.white,
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    fontSize: 9,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' },
                    1: { cellWidth: 120 },
                    2: { cellWidth: 35, halign: 'right' }
                },
                margin: { left: this.margin, right: this.margin },
                didDrawPage: (data) => {
                    this.currentY = data.cursor.y;
                }
            });
        }

        this.currentY = doc.autoTable.previous.finalY + 5;

        // Total de superficie
        if (totalSuperficie > 0) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...this.colors.gray);
            doc.text(`Total de superficie: ${totalSuperficie.toFixed(2)} m²`, this.margin, this.currentY);
            this.currentY += 10;
        }
    }

    /**
     * Agrega sección de totales
     * @param {Object} quoteData
     */
    addTotals(quoteData) {
        const doc = this.doc;
        
        // Verificar si hay espacio, si no, nueva página
        if (this.currentY > this.pageHeight - 80) {
            doc.addPage();
            this.currentY = 20;
        }

        const subtotal = quoteData.subtotal || 0;
        const iva = quoteData.iva || 0;
        const total = quoteData.totalCliente || quoteData.total || 0;
        const anticipo = quoteData.anticipo || 0;
        const saldo = quoteData.saldo || (total - anticipo);

        // Rectángulo de fondo para totales
        const boxHeight = 45;
        doc.setFillColor(248, 250, 252);
        doc.rect(this.pageWidth - 80, this.currentY, 60, boxHeight, 'F');

        // Líneas de totales
        doc.setFontSize(10);
        let yPos = this.currentY + 8;

        // Subtotal
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.colors.dark);
        doc.text('Subtotal:', this.pageWidth - 75, yPos);
        doc.text(`$ ${this.formatCurrency(subtotal)}`, this.pageWidth - 25, yPos, { align: 'right' });
        yPos += 7;

        // IVA
        if (iva > 0) {
            doc.text('IVA (21%):', this.pageWidth - 75, yPos);
            doc.text(`$ ${this.formatCurrency(iva)}`, this.pageWidth - 25, yPos, { align: 'right' });
            yPos += 7;
        }

        // Línea separadora
        doc.setDrawColor(...this.colors.gray);
        doc.line(this.pageWidth - 75, yPos, this.pageWidth - 25, yPos);
        yPos += 7;

        // Total
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...this.colors.primary);
        doc.text('TOTAL:', this.pageWidth - 75, yPos);
        doc.text(`$ ${this.formatCurrency(total)}`, this.pageWidth - 25, yPos, { align: 'right' });

        this.currentY += boxHeight + 10;

        // Información de anticipo y saldo (si aplica)
        if (anticipo > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.colors.gray);
            doc.text(`Anticipo: $ ${this.formatCurrency(anticipo)}`, this.pageWidth - 75, this.currentY);
            doc.text(`Saldo: $ ${this.formatCurrency(saldo)}`, this.pageWidth - 75, this.currentY + 5);
            this.currentY += 10;
        }
    }

    /**
     * Agrega footer con condiciones
     */
    addFooter() {
        const doc = this.doc;
        
        // Posicionar en la parte inferior
        const footerY = this.pageHeight - 35;
        
        // Línea separadora
        doc.setDrawColor(...this.colors.gray);
        doc.setLineWidth(0.5);
        doc.line(this.margin, footerY, this.pageWidth - this.margin, footerY);
        
        // Condiciones
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.colors.gray);
        
        const conditions = [
            '• Presupuesto válido por 15 días',
            '• Los precios no incluyen IVA (salvo indicación)',
            '• Tiempo de entrega: a coordinar'
        ];
        
        let yPos = footerY + 5;
        conditions.forEach(condition => {
            doc.text(condition, this.margin, yPos);
            yPos += 4;
        });

        // Número de página
        doc.setFontSize(8);
        doc.setTextColor(...this.colors.gray);
        const pageText = `Presupuesto generado por Sistema MR Letreros - Página ${doc.internal.getNumberOfPages()}`;
        doc.text(pageText, this.pageWidth / 2, this.pageHeight - 10, { align: 'center' });
    }

    /**
     * Carga la librería jsPDF
     */
    async loadJsPDF() {
        return new Promise((resolve, reject) => {
            if (window.jspdf) {
                resolve();
                return;
            }

            // Cargar jsPDF desde CDN
            const script1 = document.createElement('script');
            script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script1.onload = () => {
                // Cargar autoTable
                const script2 = document.createElement('script');
                script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
                script2.onload = () => resolve();
                script2.onerror = () => reject(new Error('Error cargando autoTable'));
                document.head.appendChild(script2);
            };
            script1.onerror = () => reject(new Error('Error cargando jsPDF'));
            document.head.appendChild(script1);
        });
    }

    /**
     * Carga una imagen como base64
     * @param {string} url
     * @returns {Promise<string>}
     */
    async loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Error cargando imagen'));
            img.src = url;
        });
    }

    /**
     * Formatea moneda
     * @param {number} num
     * @returns {string}
     */
    formatCurrency(num) {
        return new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    /**
     * Formatea fecha
     * @param {string} dateStr
     * @returns {string}
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    /**
     * Descarga el PDF
     * @param {string} filename
     */
    download(filename) {
        if (!this.doc) {
            console.error('No hay documento PDF generado');
            return;
        }
        this.doc.save(filename);
    }

    /**
     * Abre el PDF en nueva ventana
     */
    openInNewWindow() {
        if (!this.doc) {
            console.error('No hay documento PDF generado');
            return;
        }
        window.open(this.doc.output('bloburl'), '_blank');
    }
}

// Exportar para uso global
window.PDFGenerator = PDFGenerator;

console.log('[PDF-GENERATOR] 📄 Sistema de PDFs cargado');
