# -*- coding: utf-8 -*-
# Generated by Django 1.11.4 on 2018-02-28 08:53
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('nfdcore', '0033_auto_20180226_2031'),
    ]

    operations = [
        migrations.AddField(
            model_name='taxon',
            name='leap_concern',
            field=models.NullBooleanField(default=False),
        ),
    ]
