FROM php:8.2-apache

# Instalacja zależności systemowych i rozszerzeń PHP
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    zip \
    unzip \
    ghostscript \
    imagemagick \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd mysqli pdo_mysql

# Konfiguracja ImageMagick (odblokowanie PDF)
RUN sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml || true

# Włączenie mod_rewrite i mod_headers dla Apache
RUN a2enmod rewrite headers

# Ustawienie katalogu roboczego
WORKDIR /var/www/html

# Kopiowanie niestandardowej konfiguracji Apache (jeśli potrzebna, na razie standardowa wystarczy)
# Opcjonalnie możemy zmienić DocumentRoot, ale domyślnie /var/www/html jest ok, 
# o ile zamontujemy tam cały projekt.

# Uprawnienia (ważne, aby Apache mógł zapisywać pliki, np. uploady)
# W kontenerze Apache działa zazwyczaj jako www-data
RUN chown -R www-data:www-data /var/www/html







