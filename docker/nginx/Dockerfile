# Lonca önündeki Nginx: HTTPS sonlandırma + Let's Encrypt sertifikası. openssl, sertifika alınana kadar
# geçici (kendinden imzalı) sertifika üretmek için gerekir.
FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY lonca.conf.template /etc/nginx/templates/default.conf.template
COPY 40-lonca-sertifika.sh /docker-entrypoint.d/40-lonca-sertifika.sh
RUN chmod +x /docker-entrypoint.d/40-lonca-sertifika.sh && mkdir -p /var/www/certbot /etc/nginx/ssl
