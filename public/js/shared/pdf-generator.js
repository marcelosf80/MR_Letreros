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

        // Cache para imágenes
        this.assets = {
            header: null,
            footer: null,
            background: null
        };
    }

    /**
     * Pre-carga los assets necesarios (imágenes)
     */
    async preloadAssets() {
        // Cargar assets de forma independiente para mayor resiliencia
        const load = async (key, path) => {
            try {
                this.assets[key] = await this.loadImage(path);
                console.log(`[PDF-GENERATOR] 🖼️ Asset cargado: ${key}`);
            } catch (e) {
                console.warn(`[PDF-GENERATOR] ⚠️ No se pudo cargar ${key}:`, e.message);
            }
        };

        await Promise.all([
            load('header', 'img/encabezado pdf.png'),
            load('footer', 'img/pie pdf.png'),
            load('background', 'img/fondo pdf.png')
        ]);
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

        // Cargar assets
        await this.preloadAssets();

        // Detectar constructor jsPDF de manera robusta
        let jsPDFConstructor;
        if (window.jspdf && window.jspdf.jsPDF) {
            jsPDFConstructor = window.jspdf.jsPDF;
        } else if (window.jsPDF) {
            jsPDFConstructor = window.jsPDF;
        } else if (typeof window.jspdf === 'function') {
            jsPDFConstructor = window.jspdf;
        }

        if (!jsPDFConstructor) {
            throw new Error('No se pudo encontrar el constructor jsPDF. Verifica que la librería esté cargada.');
        }

        this.doc = new jsPDFConstructor('p', 'mm', 'a4');
        
        // Sobrescribir addPage para automatizar fondo y encabezado
        const self = this;
        const originalAddPage = this.doc.addPage;
        this.doc.addPage = function() {
            originalAddPage.apply(this, arguments);
            self.addBackground();
            self.addHeader();
            return this;
        };

        this.currentY = 20;

        // Agregar contenido inicial
        this.addBackground();
        this.addHeader();
        this.addClientInfo(quoteData);
        this.addProductsTable(quoteData);
        this.addTotals(quoteData);
        this.addFooter(quoteData);
        
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
        
        // Cargar assets
        await this.preloadAssets();

        // Detectar constructor jsPDF
        let jsPDFConstructor;
        if (window.jspdf && window.jspdf.jsPDF) {
            jsPDFConstructor = window.jspdf.jsPDF;
        } else if (window.jsPDF) {
            jsPDFConstructor = window.jsPDF;
        } else if (typeof window.jspdf === 'function') {
            jsPDFConstructor = window.jspdf;
        }

        if (!jsPDFConstructor) {
            throw new Error('No se pudo encontrar el constructor jsPDF. Verifica que la librería esté cargada.');
        }

        this.doc = new jsPDFConstructor('p', 'mm', 'a4');

        // Sobrescribir addPage para automatizar fondo y encabezado
        const self = this;
        const originalAddPage = this.doc.addPage;
        this.doc.addPage = function() {
            originalAddPage.apply(this, arguments);
            self.addBackground();
            self.addHeader();
            return this;
        };

        this.currentY = 20;

        this.addBackground();
        this.addHeader();
        this.addClientInfo(quoteData, 'CLIENTES');
        this.addProductsTable(quoteData);
        this.addTotals(quoteData);
        this.addFooter(quoteData);
        
        return this.doc;
    }

    /**
     * Agrega header con logo y datos de la empresa
     */
    addHeader() {
        const doc = this.doc;
        
        if (this.assets.header && this.assets.header.width > 0 && this.assets.header.data) {
            const img = this.assets.header;
            // Calcular altura proporcional al ancho de la página
            const ratio = img.height / img.width;
            const headerHeight = this.pageWidth * ratio;
            
            doc.addImage(img.data, 'PNG', 0, 0, this.pageWidth, headerHeight);
            this.currentY = headerHeight + 5; // Margen dinámico después del header
        } else {
            this.currentY = 20;
        }
    }

    /**
     * Agrega imagen de fondo a la página actual
     */
    addBackground() {
        if (this.assets.background && this.assets.background.data) {
            const img = this.assets.background;
            // El fondo se estira para cubrir toda la página (es lo esperado para un fondo decorativo)
            // pero si se prefiere mantener ratio se podría centrar. 
            // Por defecto, lo dejamos cubrir todo el A4.
            this.doc.addImage(img.data, 'PNG', 0, 0, this.pageWidth, this.pageHeight);
        }
    }


    /**
     * Agrega información del cliente
     * @param {Object} quoteData
     * @param {string} type - 'GREMIO' o 'CLIENTES'
     */
    addClientInfo(quoteData, type = 'GREMIO') {
        const doc = this.doc;
        
        // Texto de fecha arriba a la izquierda (como en la captura)
        doc.setTextColor(...this.colors.dark);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const fecha = this.formatDate(quoteData.fecha || new Date().toISOString());
        doc.text(fecha, this.margin, this.currentY);
        
        this.currentY += 12;

        // Título del presupuesto
        doc.setFontSize(18);
        doc.text(`PRESUPUESTO: ${quoteData.title || quoteData.cliente?.nombre || 'General'}`, this.margin + 5, this.currentY);
        
        this.currentY += 8;

        // Texto introductorio (como en la captura)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const intro = "De nuestra consideración, tenemos el agrado de dirigirnos a ud a los efectos de hacerle llegar una cotización por el presupuesto solicitado.";
        const splitIntro = doc.splitTextToSize(intro, this.pageWidth - 2 * this.margin - 10);
        doc.text(splitIntro, this.margin + 5, this.currentY);
        
        this.currentY += (splitIntro.length * 5) + 10;

        // Datos del cliente (sin rectángulos de fondo, más limpio)
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL CLIENTE', this.margin + 5, this.currentY);
        
        doc.setFont('helvetica', 'normal');
        const clientName = quoteData.cliente?.nombre || quoteData.clientName || 'Sin especificar';
        const clientPhone = quoteData.cliente?.telefono || quoteData.clientPhone || 'Sin especificar';
        const clientEmail = quoteData.cliente?.email || quoteData.clientEmail || '';
        
        this.currentY += 6;
        doc.text(`Cliente: ${clientName}`, this.margin + 5, this.currentY);
        this.currentY += 5;
        doc.text(`Contacto: ${clientPhone}`, this.margin + 5, this.currentY);
        if (clientEmail) {
            this.currentY += 5;
            doc.text(`Email: ${clientEmail}`, this.margin + 5, this.currentY);
        }
        
        this.currentY += 15;
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

        let visibleItems = [];
        let costosOcultos = 0;

        // Función auxiliar para determinar si se oculta el ítem (absorbido por otro)
        const debeOcultarse = (nombre) => {
            if (!nombre) return false;
            const n = nombre.toLowerCase();
            return n.includes('pintura') || n.includes('colocacion') || n.includes('colocación') || n.includes('instalacion') || n.includes('instalación');
        };

        // Función auxiliar para ocultar solo el PRECIO visualmente
        const ocultarSoloPrecio = (nombre, categoria) => {
            if (!nombre) return false;
            const n = nombre.toLowerCase().trim();
            const c = (categoria || '').toLowerCase().trim();
            return n === 'otros' || n === 'otro' || c === 'otros' || c === 'otro';
        };

        // Productos normales - Mapeo corregido para Clientes/Gremio
        productos.forEach(prod => {
            const nombre = prod.producto || prod.productName || prod.name || 'Producto';
            const cantidad = parseInt(prod.cantidad || prod.quantity || 1);
            const ancho = parseFloat(prod.ancho || prod.width || 0);
            const alto = parseFloat(prod.alto || prod.height || 0);
            const unidad = prod.unidad || prod.unit || 'm²';
            const total = parseFloat(prod.total || prod.totalPrecio || prod.price || prod.baseTotal || 0);
            const unitPrice = parseFloat(prod.precioUnitario || prod.unitPrice || (total / cantidad) || 0);
            
            // Sumar a superficie si es m²
            if (unidad === 'm²' || (ancho > 0 && alto > 0)) {
                totalSuperficie += (ancho * alto) / 10000 * cantidad;
            }

            let detalles = '';
            const skipDimensions = nombre.toLowerCase().includes('laca') || 
                                  unidad === 'unidad' || 
                                  unidad === 'par';

            if ((unidad === 'm²' || (ancho > 0 && alto > 0)) && !skipDimensions) {
                detalles = `Medidas: ${ancho} x ${alto} cm (${((ancho * alto) / 10000).toFixed(4)} m²)`;
            } else if (unidad === 'ml' && !skipDimensions) {
                detalles = `Medidas: ${(ancho || alto)} cm`;
            }

            const descripcion = [
                nombre.toUpperCase(),
                `${detalles} | Cantidad: ${cantidad} unid.`
            ].join('\n');
            
            const esOtrosItem = ocultarSoloPrecio(nombre, prod.categoria);
            const ocultarTotalmente = debeOcultarse(nombre) && !esOtrosItem;

            if (ocultarTotalmente) {
                costosOcultos += total;
            } else {
                if (esOtrosItem) costosOcultos += total;
                
                visibleItems.push({
                    descripcion: descripcion,
                    total: esOtrosItem ? 0 : total,
                    esOtros: esOtrosItem
                });
            }
        });

        // Categorías múltiples
        if (multiCategories && multiCategories.categories) {
            multiCategories.categories.forEach(cat => {
                const nombreCat = cat.name || 'Categoría';
                const width = cat.width || multiCategories.sharedDimensions?.width || 0;
                const height = cat.height || multiCategories.sharedDimensions?.height || 0;
                const m2 = cat.m2 || cat.frozenM2 || (width * height) || 0;
                const catTotal = parseFloat(cat.totalPrice || 0);

                totalSuperficie += m2;

                let detalles = '';
                const skipDimensions = nombreCat.toLowerCase().includes('laca') || 
                                      nombreCat.toLowerCase().includes('servicio') ||
                                      cat.unit === 'unidad';

                if (m2 > 0 && !skipDimensions) {
                    detalles = `Medidas: ${width}m x ${height}m (${m2.toFixed(2)}m²)`;
                }
                
                const descripcion = [
                    nombreCat.toUpperCase(),
                    detalles
                ].filter(Boolean).join('\n');
                
                const esOtrosItem = ocultarSoloPrecio(nombreCat, cat.categoria || '');
                const ocultarTotalmente = debeOcultarse(nombreCat) && !esOtrosItem;
                
                if (ocultarTotalmente) {
                    costosOcultos += catTotal;
                } else {
                    if (esOtrosItem) costosOcultos += catTotal;

                    visibleItems.push({
                        descripcion: descripcion,
                        total: esOtrosItem ? 0 : catTotal,
                        esOtros: esOtrosItem
                    });
                }
            });
        }

        // Servicios de terceros
        terceros.forEach(terc => {
            const nombreSrv = terc.serviceName || terc.nombre || 'Servicio';
            const descripcion = [
                nombreSrv,
                terc.description || ''
            ].filter(Boolean).join('\n');
            const tercTotal = parseFloat(terc.total || terc.totalPrecio || terc.costo || 0);
            
            const esOtrosItem = ocultarSoloPrecio(nombreSrv, terc.categoria || '');
            const ocultarTotalmente = (debeOcultarse(nombreSrv) || debeOcultarse(terc.description)) && !esOtrosItem;
            
            if (ocultarTotalmente) {
                costosOcultos += tercTotal;
            } else {
                if (esOtrosItem) costosOcultos += tercTotal;

                visibleItems.push({
                    descripcion: descripcion,
                    total: esOtrosItem ? 0 : tercTotal,
                    esOtros: esOtrosItem
                });
            }
        });

        // Absorber costos ocultos en el primer ítem visible
        if (visibleItems.length > 0 && costosOcultos > 0) {
            visibleItems[0].total += costosOcultos;
        } else if (visibleItems.length === 0 && costosOcultos > 0) {
            // Si todo era oculto (raro, pero puede pasar)
            visibleItems.push({
                descripcion: "TRABAJO GENERAL CON INSTALACIÓN",
                total: costosOcultos
            });
        }

        // Poblar tableData
        visibleItems.forEach(item => {
            tableData.push([
                itemNumber++,
                item.descripcion,
                item.esOtros ? "-" : `$ ${this.formatCurrency(item.total)}`
            ]);
        });

        // Dibujar tabla con margen superior dinámico si hay header
        const headerRatio = this.assets.header ? (this.assets.header.height / this.assets.header.width) : 0;
        const headerHeight = this.assets.header ? (this.pageWidth * headerRatio) : 20;

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
                margin: { top: headerHeight + 10, left: this.margin, right: this.margin },
                didDrawPage: (data) => {
                    // Ya no necesitamos dibujar fondo/header aquí porque addPage está sobrescrito
                    // Pero sí necesitamos actualizar currentY
                    if (data.cursor && data.cursor.y) {
                        this.currentY = data.cursor.y;
                    }
                }
            });
        }

        this.currentY += 5;
    }

    /**
     * Agrega sección de totales
     * @param {Object} quoteData
     */
    addTotals(quoteData) {
        const doc = this.doc;
        
        // Verificar si hay espacio, si no, nueva página
        if (this.currentY > this.pageHeight - 80) {
            this.doc.addPage();
            this.addBackground();
            this.addHeader();
            // addHeader ya establece this.currentY correctamente
        }


        const subtotal = quoteData.subtotal || 0;
        const iva = quoteData.iva || 0;
        const total = quoteData.totalCliente || quoteData.total || 0;
        const anticipo = quoteData.anticipo || 0;
        const saldo = quoteData.saldo || (total - anticipo);

        // Sin rectángulos de fondo, usamos texto claro y alineado
        doc.setFontSize(11);
        let yPos = this.currentY + 10;

        // Subtotal
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.colors.dark);
        doc.text('Subtotal:', this.pageWidth - 85, yPos);
        doc.text(`$ ${this.formatCurrency(subtotal)}`, this.pageWidth - this.margin - 5, yPos, { align: 'right' });
        yPos += 7;

        // IVA
        if (iva > 0) {
            doc.text('IVA (21%):', this.pageWidth - 85, yPos);
            doc.text(`$ ${this.formatCurrency(iva)}`, this.pageWidth - this.margin - 5, yPos, { align: 'right' });
            yPos += 7;
        }

        // Ajuste / Descuento (%) - ELIMINADO PARA EL PDF SEGÚN SOLICITUD DEL USUARIO

        // Línea decorativa minimalista
        doc.setDrawColor(200, 200, 200);
        doc.line(this.pageWidth - 85, yPos - 2, this.pageWidth - this.margin - 5, yPos - 2);
        yPos += 3;

        // Total
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...this.colors.primary);
        doc.text('TOTAL:', this.pageWidth - 85, yPos + 2);
        doc.text(`$ ${this.formatCurrency(total)}`, this.pageWidth - this.margin - 5, yPos + 2, { align: 'right' });

        this.currentY = yPos + 15;
 
        // Información de anticipo y entrega (60% SEÑA)
        const seña60 = total * 0.6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...this.colors.primary);
        doc.text(`PARA INICIAR EL TRABAJO SE DEBE ABONAR EL 60% DE SEÑA: $ ${this.formatCurrency(seña60)}`, this.margin, this.currentY);
        
        this.currentY += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...this.colors.dark);
        doc.text(`Una vez señado el trabajo, el tiempo estimado de entrega es de 10 días hábiles.`, this.margin, this.currentY);
        
        this.currentY += 10;
        
        if (anticipo > 0) {
            doc.text(`Anticipo abonado: $ ${this.formatCurrency(anticipo)}`, this.pageWidth - 85, this.currentY);
            doc.text(`Saldo Restante: $ ${this.formatCurrency(saldo)}`, this.pageWidth - 85, this.currentY + 6);
            this.currentY += 15;
        }

    }

    /**
     * Agrega footer con condiciones
     */
    addFooter(quoteData = {}) {
        const doc = this.doc;
        
        // Textos legales (como en la captura)
        doc.setTextColor(...this.colors.dark);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const footerY = this.pageHeight - 45;
        doc.text('Validez de la cotización: 10 días', this.margin, footerY);
        doc.text('El trabajo se GARANTIZA por un plazo de 6 meses, por defectos de fabricación y/o materiales', this.margin, footerY + 5);
        
        if (this.assets.footer) {
            const img = this.assets.footer;
            const ratio = img.height / img.width;
            const footerHeight = this.pageWidth * ratio;
            
            doc.addImage(img.data, 'PNG', 0, this.pageHeight - footerHeight, this.pageWidth, footerHeight);
        }

        // Número de página (opcional, sobre el diseño)
        doc.setFontSize(8);
        doc.setTextColor(200, 200, 200);
        const pageText = `Página ${doc.internal.getNumberOfPages()}`;
        doc.text(pageText, this.pageWidth - 15, this.pageHeight - 12, { align: 'right' });
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
     * Carga una imagen como base64 y captura sus dimensiones
     * @param {string} url
     * @returns {Promise<Object>} - {data: base64, width: px, height: px}
     */
    async loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // No usamos crossOrigin por defecto para recursos locales para evitar tainted canvas innecesarios
            // Si la URL es externa (empieza con http), sí lo usamos
            if (url.startsWith('http')) {
                img.crossOrigin = 'Anonymous';
            }
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width || 1;
                    canvas.height = img.height || 1;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const base64Data = canvas.toDataURL('image/png');
                    resolve({
                        data: base64Data,
                        width: img.width,
                        height: img.height
                    });
                } catch (e) {
                    console.error('[PDF] Error al procesar imagen (posible canvas tainted):', url, e);
                    // Devolvemos null en lugar de rechazar para que el PDF se genere sin la imagen pero no falle
                    resolve(null);
                }
            };
            img.onerror = () => {
                console.warn('[PDF] No se pudo cargar la imagen:', url);
                resolve(null); // Resolvemos null para evitar colgar Promise.all
            };
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
